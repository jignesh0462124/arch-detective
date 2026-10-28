from __future__ import annotations

import io
import json
import zipfile

import pytest
from fastapi import HTTPException, UploadFile

from app.api import local_scan as api
from app.api.local_scan_evidence import build_evidence_summary, ground_ai_findings


@pytest.fixture(autouse=True)
def isolated_scan_store(monkeypatch, tmp_path):
    monkeypatch.setattr(api, "_SCANS", {})
    monkeypatch.setattr(api, "_DATA_DIR", tmp_path)


def test_relative_imports_are_not_path_traversal():
    findings = api._static_code_scan([{"path": "a.js", "content": 'import db from "../db.js";\nconst p = "../../assets";'}], ["gdpr"])
    assert not any(f["cwe_id"] == "CWE-22" for f in findings)


def test_parameterized_queries_are_not_sql_injection():
    code = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
    assert not any(f["cwe_id"] == "CWE-89" for f in api._static_code_scan([{"path": "a.py", "content": code}], ["gdpr"]))


def test_unsafe_file_reads_are_detected():
    values = api._static_code_scan([{"path": "a.php", "content": "<?php\nreadfile($_GET['path']);"}], ["gdpr"])
    assert any(f["cwe_id"] == "CWE-22" and f["line_number"] == 2 for f in values)


def test_sql_findings_in_separate_files_keep_correct_line_and_evidence():
    code = '\n\nquery = "SELECT * FROM users WHERE id=" + user_id'
    values = api._static_code_scan([{"path": p, "content": code} for p in ["a.py", "b.py"]], ["gdpr"])
    sql = [f for f in values if f["cwe_id"] == "CWE-89"]
    assert len(sql) == 2
    assert {f["file_path"] for f in sql} == {"a.py", "b.py"}
    assert all(f["line_number"] == 3 for f in sql)
    assert all(v["framework"] == "gdpr" for f in sql for v in f["violations"])


def test_ai_suggestions_require_actual_file_and_literal_source():
    files = [{"path": "a.py", "content": "# header\nunsafe(user)\n"}]
    base = {"title": "Unsafe call", "severity": "high", "file_path": "a.py", "code_snippet": "unsafe(user)", "line_number": 999}
    values = ground_ai_findings([None, "bad", {**base, "file_path": "invented.py"}, {**base, "code_snippet": "invented()"}, base], files)
    assert len(values) == 1
    assert values[0]["line_number"] == 2
    assert "cvss_score" not in values[0]


def test_summary_is_count_based_and_does_not_claim_compliance():
    assert build_evidence_summary("Fixture", [{"title": "High finding", "severity": "high"}])["overall_posture"] == "High"
    empty = build_evidence_summary("Fixture", [])
    assert empty["overall_posture"] == "Minimal"
    assert empty["top_priorities"] == []
    assert "does not prove" in empty["summary"]


def test_context_samples_large_first_file_and_stays_within_budget():
    context = api._build_code_context([{"path": "large.py", "content": "x" * 100000}, {"path": "small.py", "content": "hello"}], max_chars=1000)
    assert "large.py" in context and "small.py" in context
    assert len(context) <= 1000


@pytest.mark.asyncio
async def test_clean_scan_stays_empty_without_fabricated_baseline(monkeypatch):
    async def no_ai(**_kwargs): return "[]"
    monkeypatch.setattr(api, "_run_groq_agent", no_ai)
    await api._scan_pipeline("clean", [{"path": "a.py", "content": "print('hello')"}], "print('hello')", "Fixture", ["gdpr"])
    result = api._SCANS["clean"]["result"]
    assert result["findings"] == []
    assert result["summary"]["overall_posture"] == "Minimal"
    assert result["analysis"]["files_scanned"] == 1
    assert api._SCANS["clean"]["events"][-1]["step"] == "done"


@pytest.mark.asyncio
async def test_malformed_ai_entries_do_not_crash_pipeline(monkeypatch):
    async def malformed(**_kwargs): return '[null, 1, "bad", {"title": "Invented", "file_path": "missing.py"}]'
    monkeypatch.setattr(api, "_run_groq_agent", malformed)
    await api._scan_pipeline("malformed", [{"path": "a.py", "content": "print('hello')"}], "sample", "Fixture", ["gdpr"])
    assert api._SCANS["malformed"]["status"] == "done"
    assert api._SCANS["malformed"]["result"]["findings"] == []


@pytest.mark.asyncio
async def test_pending_result_contains_progress_and_failure_is_terminal():
    api._SCANS["pending"] = {"status": "running", "events": [{"step": "finding", "progress": 30}]}
    pending = await api.get_result("pending")
    assert pending.status_code == 202
    assert json.loads(pending.body)["events"][0]["progress"] == 30
    api._SCANS["failed"] = {"status": "error", "events": [{"step": "error", "label": "Broken archive"}]}
    with pytest.raises(HTTPException) as exc:
        await api.get_result("failed")
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_empty_archive_and_unknown_framework_are_rejected():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w"):
        pass
    with pytest.raises(HTTPException) as exc:
        await api.start_scan(UploadFile(filename="empty.ZIP", file=io.BytesIO(buffer.getvalue())), "Fixture", "gdpr")
    assert exc.value.status_code == 400
    assert "No supported source" in exc.value.detail
    with pytest.raises(HTTPException) as exc:
        await api.start_scan(UploadFile(filename="test.zip", file=io.BytesIO(buffer.getvalue())), "Fixture", "unknown")
    assert exc.value.status_code == 400


def test_scan_cache_identifier_cannot_escape_cache_directory():
    for value in ["../other", "a/b", "C:\\x", "../../x", ""]:
        with pytest.raises(HTTPException):
            api._scan_file_path(value, "json")
    assert api._scan_file_path("fixture-123", "json").parent == api._DATA_DIR


@pytest.mark.parametrize("source, expected_findings", [("print('hello')", False), ("readfile($_GET['path']);", True)])
def test_upload_result_and_sse_http_flow_without_external_ai(monkeypatch, source, expected_findings):
    import time
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    ai_calls = []
    async def no_ai(**kwargs):
        ai_calls.append(kwargs)
        return "[]"
    monkeypatch.setattr(api, "_run_groq_agent", no_ai)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("project/app.php", source)
    application = FastAPI()
    application.include_router(api.router)
    @application.middleware("http")
    async def fixture_peer(request, call_next):
        request.scope["client"] = ("127.0.0.1", 12345)
        return await call_next(request)
    from app.config import settings
    monkeypatch.setattr(settings, "LOCAL_SCAN_ENABLED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "DEBUG", True)
    with TestClient(application, base_url="http://127.0.0.1") as client:
        response = client.post("/api/local/scan", files={"file": ("Fixture.ZIP", buffer.getvalue(), "application/zip")}, data={"target_name": "HTTP regression fixture", "frameworks": "gdpr"})
        assert response.status_code == 200
        scan_id = response.json()["scan_id"]
        for _ in range(100):
            response = client.get(f"/api/local/scan/{scan_id}/result")
            if response.status_code != 202:
                break
            time.sleep(0.01)
        assert response.status_code == 200
        result = response.json()
        assert bool(result["findings"]) == expected_findings
        assert result["frameworks"] == ["gdpr"]
        assert result["analysis"]["files_scanned"] == 1
        assert len(ai_calls) == 1  # No second, redundant summary request.
        stream = client.get(f"/api/local/scan/{scan_id}/stream")
        assert stream.status_code == 200
        assert '"step": "done"' in stream.text
