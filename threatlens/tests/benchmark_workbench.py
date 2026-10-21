"""Offline scheduling benchmark, not a claim about hosted/network acceptance targets.

Run from threatlens: python tests/benchmark_workbench.py --repeats 3
Uses real ZIP validation/static analysis/grounding/merge/persistence orchestration,
deterministic model replies and explicit simulated request latency. No cloud writes.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import uuid
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.api import audit_workbench as api, local_scan
from app.ingestion.source_snapshot import read_zip_snapshot, redact_text
from test_audit_workbench import MemoryStore, archive


class TimedStore(MemoryStore):
    def __init__(self, pooled):
        super().__init__()
        self.pooled = pooled
        self.upload_delay = .02 if pooled else .06
        self.started = perf_counter()
        self.first_readable = None

    async def rest(self, method, table, **kwargs):
        nested = kwargs.pop("_bench_nested", False)
        if not nested:
            await asyncio.sleep(.005 if self.pooled else .02)
        if isinstance(kwargs.get("body"), list):
            kwargs["_bench_nested"] = True
        result = await super().rest(method, table, **kwargs)
        if self.first_readable is None and method == "PATCH" and (
            table == "snapshot_files" and kwargs.get("body", {}).get("preview_state") == "ready"
            or table == "source_snapshots" and kwargs.get("body", {}).get("state") == "ready"
        ):
            self.first_readable = perf_counter() - self.started
        return result


async def model_fixture(**kwargs):
    await asyncio.sleep(.08)
    return json.dumps([{"title": "Source-backed model review", "severity": "medium", "description": "User input reaches output; review context.", "file_path": "src/000.php", "line_number": 2, "cwe_id": "CWE-200", "code_snippet": "echo $_GET['name'];"}])


async def baseline(repository, scan_id, snapshot_id, files, analysis):
    """Reference old schedule: all source (4 workers), then full analysis, then writes."""
    started = perf_counter()
    await repository.rest("POST", "source_snapshots", body={"id": snapshot_id, "scan_id": scan_id, "state": "indexing"})
    for offset in range(0, len(files), 100):
        await repository.rest("POST", "snapshot_files", body=[{k: v for k, v in f.items() if k != "content"} for f in files[offset:offset + 100]])
    slots = asyncio.Semaphore(4)
    async def upload(file):
        async with slots:
            await repository.upload_text(file["id"], file["content"])
    await asyncio.gather(*(upload(file) for file in files if "content" in file))
    await repository.rest("PATCH", "source_snapshots", params={"id": f"eq.{snapshot_id}"}, body={"state": "ready"})
    source_seconds = perf_counter() - started
    analysis_started = perf_counter()
    result = await local_scan._scan_pipeline(scan_id, analysis, redact_text(local_scan._build_code_context(analysis)), "Benchmark", ["soc2"], persist_local=False, suggest_all_frameworks=False)
    analysis_seconds = perf_counter() - analysis_started
    persist_started = perf_counter()
    # Same batch count as the real three evidence tables, without fabricating cloud rows.
    for table in ("findings", "compliance_violations", "finding_locations"):
        for offset in range(0, len(result["findings"]), 100):
            await repository.rest("POST", table, body=[{"id": str(uuid.uuid4())} for _ in result["findings"][offset:offset + 100]])
    for table in ("scans", "audit_workbench_jobs"):
        await repository.rest("PATCH", table, params={"scan_id": f"eq.{scan_id}"}, body={"status": "completed"})
    return result, {"source_preparation": source_seconds, "analysis": analysis_seconds, "persistence": perf_counter() - persist_started}


async def run(count, repeats):
    records = {"baseline_schedule": [], "optimized": []}
    canonical = None
    for _ in range(repeats):
        for mode in records:
            snapshot_id, scan_id, workspace_id = (str(uuid.uuid4()) for _ in range(3))
            content = archive({f"src/{i:03}.php": "<?php\necho $_GET['name'];\n" + "// inert fixture context\n" * 200 for i in range(count)})
            validation_started = perf_counter()
            files, analysis, exclusions = read_zip_snapshot(content, snapshot_id)
            validation = perf_counter() - validation_started
            repository = TimedStore(mode == "optimized")
            repository.tables["scans"] = [{"id": scan_id, "status": "running"}]
            repository.tables["audit_workbench_jobs"] = [{"scan_id": scan_id, "status": "running"}]
            if mode == "optimized":
                await api.run_audit(repository, scan_id, snapshot_id, workspace_id, workspace_id, "Benchmark", ["soc2"], files, analysis, exclusions, validation)
                metadata = repository.tables["audit_workbench_jobs"][0]["result_metadata"]
                findings = repository.tables["findings"]
                timings = metadata["timings"]
                assert metadata["analysis"]["mode"] == "static_and_ai"
                assert metadata["analysis"]["files_scanned"] == count
            else:
                result, timings = await baseline(repository, scan_id, snapshot_id, files, analysis)
                findings = result["findings"]
            signature = [(f["title"], f["severity"], f.get("cwe_id"), f.get("file_path"), f.get("line_number")) for f in findings]
            if canonical is None:
                canonical = signature
            assert signature == canonical, "Finding identity/order or coverage changed"
            records[mode].append({"completion": perf_counter() - repository.started, "first_readable": repository.first_readable, "archive_validation": validation, **timings})
    return {"files": count, "findings_identical": True, "medians_seconds": {mode: {key: round(statistics.median(r[key] for r in rows), 4) for key in rows[0]} for mode, rows in records.items()}}


async def main(repeats):
    old_agent = local_scan._run_groq_agent
    old_flag = api.settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED
    local_scan._run_groq_agent = model_fixture
    api.settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED = True
    try:
        for count in (14, 90, 500):
            print(json.dumps(await run(count, repeats)), flush=True)
    finally:
        local_scan._run_groq_agent = old_agent
        api.settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED = old_flag


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, default=3, choices=range(1, 11))
    asyncio.run(main(parser.parse_args().repeats))
