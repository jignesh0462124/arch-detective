"""Authenticated ZIP orchestration and immutable source browsing for Audit Workbench."""
from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import json
import logging
import uuid
import zipfile
from time import perf_counter
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, Response

from app.auth.dependencies import bearer_scheme, get_current_user
from app.config import settings
from app.ingestion.source_snapshot import read_zip_snapshot, redact_evidence, redact_text, resolve_location
from app.schemas.auth import AuthenticatedUser
from app.storage.workbench_store import WorkbenchStore, connection
from app.api.local_scan import _build_code_context, _generate_pdf_stream, _scan_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(tags=["audit-workbench"])
_tasks: set[asyncio.Task] = set()


def now():
    return datetime.now(timezone.utc)


async def record_scan_event(repository, scan_id, workspace_id, actor_id, event_type, target_name, finding_count=None):
    """Record one transition without allowing log availability to fail a scan."""
    event_id = str(uuid.uuid5(uuid.UUID(scan_id), event_type))
    metadata = {"target": target_name}
    if finding_count is not None:
        metadata["findings"] = finding_count
    try:
        await repository.rest(
            "POST", "audit_events", params={"on_conflict": "id"},
            body={"id": event_id, "workspace_id": workspace_id,
                  "actor_user_id": actor_id, "event_type": event_type,
                  "resource_type": "scan", "resource_id": scan_id,
                  "event_metadata": metadata},
            prefer="resolution=ignore-duplicates,return=minimal",
        )
    except Exception:
        logger.warning("Could not record scan transition for %s", scan_id)


def store():
    return WorkbenchStore()


async def access_token(credentials=Depends(bearer_scheme), _user=Depends(get_current_user)):
    return credentials.credentials


@router.get("/audit-workbench/capabilities")
async def capabilities(_user=Depends(get_current_user)):
    available = bool(settings.AUDIT_WORKBENCH_ENABLED and settings.SUPABASE_SERVICE_ROLE_KEY)
    reason = None
    if available:
        try:
            repository = store()
            await asyncio.gather(*(repository.rest("GET", table, params={"select": "*", "limit": 0}) for table in ("source_snapshots", "snapshot_files", "finding_locations", "audit_workbench_jobs", "source_cleanup_queue")))
            async with connection() as client:
                response = await client.get(f"{repository.url}/storage/v1/bucket/{settings.SUPABASE_SOURCE_BUCKET}", headers={"apikey": repository.key, "Authorization": f"Bearer {repository.key}"}, timeout=10)
            available = response.is_success and response.json().get("public") is False
        except Exception:
            available = False
    if not available:
        reason = "Source workbench is awaiting backend Storage configuration or migration. Standard audits remain available."
    progressive = False
    if available and settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED:
        try:
            await repository.rest("POST", "rpc/audit_workbench_counts", body={"p_scan_id": str(uuid.UUID(int=0))})
            progressive = True
        except Exception:
            pass  # A backend deployed before the additive migration stays compatible.
    return {"enabled": available, "progressive_workbench": progressive, "reason": reason, "retention_hours": settings.SNAPSHOT_RETENTION_HOURS, "max_zip_bytes": min(settings.MAX_FILE_SIZE_MB, 50) * 1024 * 1024}


@router.post("/workspaces/{workspace_id}/audits", status_code=202)
async def start_audit(workspace_id: uuid.UUID, file: UploadFile = File(...), target_name: str = Form(..., min_length=1, max_length=200), frameworks: str = Form(...), idempotency_key: Annotated[uuid.UUID | None, Header(alias="Idempotency-Key")] = None, user: AuthenticatedUser = Depends(get_current_user), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    if not settings.AUDIT_WORKBENCH_ENABLED:
        raise HTTPException(503, "Source workbench is disabled")
    role = await repository.role(str(workspace_id), token)
    if role not in {"owner", "admin", "analyst"}:
        raise HTTPException(403, "An analyst role is required to start an audit")
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Choose a ZIP project")
    selected = list(dict.fromkeys(x.strip().lower() for x in frameworks.split(",") if x.strip()))
    if not selected or not set(selected) <= {"gdpr", "soc2", "iso27001", "pci_dss", "nist_csf"} or not target_name.strip():
        raise HTTPException(422, "Choose a project name and supported compliance frameworks")
    key = str(idempotency_key or uuid.uuid4())
    content = await file.read(min(settings.MAX_FILE_SIZE_MB, 50) * 1024 * 1024 + 1)
    if not content or len(content) > min(settings.MAX_FILE_SIZE_MB, 50) * 1024 * 1024:
        raise HTTPException(413, "Choose a nonempty ZIP within the upload limit")
    digest = hashlib.sha256(content + json.dumps([target_name.strip(), sorted(selected)]).encode()).hexdigest()
    scan_id = str(uuid.uuid5(workspace_id, f"{user.id}:{key}"))
    old = await repository.rows("audit_workbench_jobs", scan_id=f"eq.{scan_id}")
    if old:
        if old[0]["request_hash"] != digest:
            raise HTTPException(409, "This upload key belongs to a different input; start a new audit")
        return {"scan_id": scan_id, "status": old[0]["status"]}
    snapshot_id = str(uuid.uuid4())
    validation_started = perf_counter()
    try:
        files, analysis, exclusions = await asyncio.to_thread(read_zip_snapshot, content, snapshot_id)
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        raise HTTPException(400, "Archive is corrupt, unsafe, unsupported or exceeds the configured limits") from exc
    validation_seconds = perf_counter() - validation_started
    await repository.rest("POST", "scans", params={"on_conflict": "id"}, body={"id": scan_id, "workspace_id": str(workspace_id), "created_by": str(user.id), "scan_type": "codebase", "source_type": "upload", "target_name": target_name.strip(), "selected_frameworks": selected, "status": "running", "started_at": now().isoformat()}, prefer="resolution=ignore-duplicates,return=representation")
    # A trusted adapter may bind immutable repository provenance before job acceptance.
    attach = getattr(repository, "attach_source_reference", None)
    if attach is not None:
        await attach(scan_id)
    claimed = await repository.rest("POST", "audit_workbench_jobs", params={"on_conflict": "scan_id"}, body={"scan_id": scan_id, "workspace_id": str(workspace_id), "created_by": str(user.id), "idempotency_key": key, "request_hash": digest}, prefer="resolution=ignore-duplicates,return=representation")
    if claimed:
        await record_scan_event(repository, scan_id, str(workspace_id), str(user.id), "scan.started", target_name.strip())
        task = asyncio.create_task(run_audit(repository, scan_id, snapshot_id, str(workspace_id), str(user.id), target_name.strip(), selected, files, analysis, exclusions, validation_seconds))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)
    else:
        existing = await get_job(repository, scan_id)
        if not existing or existing["request_hash"] != digest:
            raise HTTPException(409, "This upload key belongs to a different input; start a new audit")
        return {"scan_id": scan_id, "status": existing["status"]}
    return {"scan_id": scan_id, "status": "running"}


async def run_audit(repository, scan_id, snapshot_id, workspace_id, actor_id, target_name, frameworks, files, analysis, exclusions, validation_seconds=0, *, extension_input=None):
    events = []
    done = asyncio.Event()
    timings = {"archive_validation": round(validation_seconds, 4)}
    source_progress = {"ready": 0, "total": sum("content" in f for f in files), "state": "preparing"}
    runtime = {"timings": timings, "source_progress": source_progress}
    source_task = None
    source_snapshot_created = False
    accepted_at = perf_counter()
    def event(value):
        if value.get("step") == "done":
            return
        events.append({"sequence": len(events) + 1, "step": value["step"], "label": redact_text(value["label"]), "progress": max(events[-1]["progress"] if events else 0, min(value.get("progress", 0), 97)), "at": now().isoformat()})

    async def persist_progress():
        while not done.is_set():
            await repository.rest("PATCH", "audit_workbench_jobs", params={"scan_id": f"eq.{scan_id}", "status": "eq.running"}, body={"events": events[-80:], "progress": events[-1]["progress"] if events else 0, "heartbeat_at": now().isoformat(), "result_metadata": runtime})
            try:
                await asyncio.wait_for(done.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass
    heartbeat = asyncio.create_task(persist_progress())
    async def prepare_source():
        nonlocal source_snapshot_created
        started = perf_counter()
        metadata_rows = []
        try:
            await repository.rest("POST", "source_snapshots", body={"id": snapshot_id, "scan_id": scan_id, "state": "indexing", "file_count": len(files), "exclusions": exclusions, "expires_at": (now() + timedelta(hours=settings.SNAPSHOT_RETENTION_HOURS)).isoformat()})
            source_snapshot_created = True
            for file in files:
                metadata = {k: v for k, v in file.items() if k != "content"}
                metadata.setdefault("content_hash", None)
                metadata["object_path"] = f"{workspace_id}/{scan_id}/{snapshot_id}/{file['id']}.txt" if "content" in file else None
                if metadata["object_path"] and settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED:
                    metadata["preview_state"] = "pending"
                metadata_rows.append(metadata)
            # Manifest precedes uploads so partial uploads remain reconcilable.
            for offset in range(0, len(metadata_rows), 100):
                await repository.rest("POST", "snapshot_files", body=metadata_rows[offset:offset + 100], prefer="return=minimal")
            semaphore = asyncio.Semaphore(8)
            async def upload_preview(file, metadata):
                async with semaphore:
                    await repository.upload_text(metadata["object_path"], file["content"])
                return file["id"]
            async def publish(ids):
                source_progress["ready"] += len(ids)
                if ids and settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED:
                    await repository.rest("PATCH", "snapshot_files", params={"snapshot_id": f"eq.{snapshot_id}", "id": f"in.({','.join(ids)})", "preview_state": "eq.pending"}, body={"preview_state": "ready"})
            previewable = sorted(((f, m) for f, m in zip(files, metadata_rows) if m["object_path"]), key=lambda pair: pair[0]["path"])
            # Make the initial window readable before filling the upload pool.
            if previewable:
                await publish([await upload_preview(*previewable[0])])
                timings["first_source_ready"] = round(perf_counter() - accepted_at, 4)
            pending = [asyncio.create_task(upload_preview(*pair)) for pair in previewable[1:]]
            batch, failures = [], []
            try:
                for completed in asyncio.as_completed(pending):
                    try:
                        batch.append(await completed)
                    except Exception as exc:
                        failures.append(type(exc).__name__)
                    if len(batch) >= 8:
                        await publish(batch)
                        batch = []
                await publish(batch)
            finally:
                # Never leave uploads running after cleanup or task cancellation.
                await asyncio.gather(*pending, return_exceptions=True)
            if failures:
                raise RuntimeError("Source upload was incomplete")
            updated = await repository.rest("PATCH", "source_snapshots", params={"id": f"eq.{snapshot_id}", "state": "eq.indexing"}, body={"state": "ready"})
            if not updated:
                # A workspace/scan can be deleted while Storage uploads are in flight.
                # Requeue every path after the uploads settle, even if a cascade's
                # original cleanup entry was already processed.
                raise RuntimeError("Source snapshot was removed during indexing")
            source_progress["state"] = "ready"
            event({"step": "extracting", "label": "Read-only source preview indexed", "progress": 13})
            return True
        except Exception:
            await repository.rest("PATCH", "source_snapshots", params={"id": f"eq.{snapshot_id}"}, body={"state": "failed"})
            # Also covers a cascade occurring after uploads started.
            await queue_source_paths(repository, metadata_rows)
            source_progress["state"] = "failed"
            event({"step": "extracting", "label": "Source indexing unavailable; continuing security analysis", "progress": 13})
            return False
        finally:
            timings["source_preparation"] = round(perf_counter() - started, 4)
    try:
        event({"step": "extracting", "label": f"Validated {len(files)} archive entries", "progress": 10})
        source_task = asyncio.create_task(prepare_source())
        analysis_started = perf_counter()
        extension_options = {"security_only": True} if extension_input is not None else {}
        result = await _scan_pipeline(scan_id, analysis, redact_text(_build_code_context(analysis)), target_name, frameworks, persist_local=False, on_event=event, suggest_all_frameworks=False, **extension_options)
        extension_rows = []
        if extension_input is not None:
            from app.scanners.extension_review import assess
            extension_rows, extension_coverage = await asyncio.to_thread(assess, files, *extension_input)
            extension_coverage["security_analysis_files"] = len(analysis)
            extension_coverage["analysis_exclusions"] = exclusions
            extension_coverage["security_analysis_limitations"] = (result.get("analysis") or {}).get("limitations", [])
            # Store policies are not GDPR/SOC2 scores. The ordinary audit pipeline
            # remains unchanged; extension audits do not imply those frameworks.
            result["framework_scores"] = {}
            for finding in result["findings"]:
                finding["violations"] = []
        timings["analysis"] = round(perf_counter() - analysis_started, 4)
        source_ready = await source_task
        persistence_started = perf_counter()
        result = redact_evidence(result)
        event({"step": "summary", "label": "Saving findings and control evidence", "progress": 97})
        persisted, finding_rows, control_rows, location_rows = [], [], [], []
        for finding in result["findings"]:
            finding_id = str(uuid.uuid4())
            finding["id"] = finding_id
            row = {k: finding.get(k) for k in ("title", "description", "severity", "cvss_score", "cvss_vector", "cwe_id", "cve_id", "file_path", "line_number", "code_snippet")}
            row.update(id=finding_id, scan_id=scan_id, source=finding.get("source", "static-rule"), state="open", remediation="\n".join(finding.get("remediation_steps") or []))
            finding_rows.append(row)
            for control in finding.get("violations", []):
                control_rows.append({"finding_id": finding_id, "framework": control["framework"], "control_id": control["control_id"], "control_title": control["control_title"], "violation_description": "Suggested mapping — review required", "evidence": finding["description"]})
            location = resolve_location(finding, files) if source_ready else {"file_id": None, "line_number": None, "match_status": "unlocated"}
            if source_snapshot_created:
                location_rows.append({"finding_id": finding_id, "snapshot_id": snapshot_id, **location})
            persisted.append(finding)
        for table, rows in [("findings", finding_rows), ("compliance_violations", control_rows), ("finding_locations", location_rows)]:
            for offset in range(0, len(rows), 100):
                await repository.rest("POST", table, body=rows[offset:offset + 100], prefer="return=minimal")
        if extension_input is not None:
            # Link only a unique exact recorded source location; do not synthesize
            # duplicate security findings or guess ambiguous source associations.
            for policy in extension_rows:
                details = policy["details"]
                matches = [f for f in finding_rows if details.get("path") and details.get("line") and f.get("file_path") == details["path"] and f.get("line_number") == details["line"]]
                policy.update(scan_id=scan_id, finding_id=matches[0]["id"] if len(matches) == 1 else None)
            for offset in range(0, len(extension_rows), 100):
                await repository.rest("POST", "extension_policy_results", body=extension_rows[offset:offset + 100], prefer="return=minimal")
            await repository.rest("PATCH", "extension_reviews", params={"scan_id": f"eq.{scan_id}"}, body={"coverage": extension_coverage})
        metadata = {k: v for k, v in result.items() if k != "findings"}
        completed_scan = await repository.rest("PATCH", "scans", params={"id": f"eq.{scan_id}", "status": "eq.running"}, body={"status": "completed", "progress": 100, "finding_count": len(persisted), "critical_count": result["severity_counts"]["critical"], "high_count": result["severity_counts"]["high"], "framework_scores": result["framework_scores"], "summary": {**result["summary"], "analysis": result["analysis"]}, "completed_at": now().isoformat()})
        if completed_scan:
            await record_scan_event(repository, scan_id, workspace_id, actor_id, "scan.completed", target_name, len(persisted))
        done.set()
        await heartbeat
        timings["persistence"] = round(perf_counter() - persistence_started, 4)
        metadata.update(runtime)
        event({"step": "summary", "label": "Audit saved — ready to review", "progress": 100})
        events[-1]["progress"] = 100
        await repository.rest("PATCH", "audit_workbench_jobs", params={"scan_id": f"eq.{scan_id}"}, body={"status": "completed", "progress": 100, "result_metadata": metadata, "events": events[-80:], "heartbeat_at": now().isoformat()})
    except Exception:
        logger.warning("Workbench scan failed: %s", scan_id)  # Never log raw source/provider errors.
        done.set()
        await asyncio.gather(heartbeat, return_exceptions=True)
        try:
            await repository.rest("PATCH", "audit_workbench_jobs", params={"scan_id": f"eq.{scan_id}"}, body={"status": "failed", "events": events[-80:], "error_message": "Audit could not be completed. Start a new audit to retry."})
            failed_scan = await repository.rest("PATCH", "scans", params={"id": f"eq.{scan_id}", "status": "eq.running"}, body={"status": "failed", "error_code": "workbench_failed", "error_message": "Audit persistence or analysis failed"})
            if failed_scan:
                await record_scan_event(repository, scan_id, workspace_id, actor_id, "scan.failed", target_name)
        except Exception:
            pass  # Stale heartbeat is reconciled independently.
    finally:
        done.set()
        if source_task:
            await asyncio.gather(source_task, return_exceptions=True)
        heartbeat.cancel()
        await asyncio.gather(heartbeat, return_exceptions=True)


async def get_job(repository, scan_id):
    jobs = await repository.rows("audit_workbench_jobs", scan_id=f"eq.{scan_id}")
    return jobs[0] if jobs else None


async def queue_source_paths(repository, entries):
    paths = [{"object_path": e["object_path"]} for e in entries if e.get("object_path")]
    for offset in range(0, len(paths), 100):
        await repository.rest("POST", "source_cleanup_queue", params={"on_conflict": "object_path"}, body=paths[offset:offset + 100], prefer="resolution=ignore-duplicates,return=minimal")


@router.get("/scans/{scan_id}/workbench/progress")
async def progress(scan_id: uuid.UUID, after: int = Query(0, ge=0), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    scan_id = str(scan_id)
    await repository.authorize(scan_id, token)
    job = await get_job(repository, scan_id)
    if not job:
        raise HTTPException(404, "This audit has no workbench job")
    return JSONResponse({"scan_id": scan_id, "status": job["status"], "progress": job["progress"], "error_message": job.get("error_message"), "created_at": job["created_at"], "source_progress": job["result_metadata"].get("source_progress"), "events": [e for e in job["events"] if e["sequence"] > after]}, headers={"Cache-Control": "no-store"})


async def snapshot_state(repository, scan_id):
    snapshot = await repository.snapshot(scan_id)
    if snapshot and datetime.fromisoformat(snapshot["expires_at"].replace("Z", "+00:00")) <= now():
        snapshot = {**snapshot, "state": "expired"}
    return snapshot


@router.get("/scans/{scan_id}/workbench")
async def overview(scan_id: uuid.UUID, workspace_id: uuid.UUID | None = None, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    scan_id = str(scan_id)
    scan = await repository.authorize(scan_id, token, str(workspace_id) if workspace_id else None)
    snapshot = await snapshot_state(repository, scan_id)
    findings = await repository.rows("findings", scan_id=f"eq.{scan_id}", order="created_at.asc,id.asc")
    # Fetch evidence in bounded batches; no per-finding read waterfall.
    controls = []
    for start in range(0, len(findings), 100):
        ids = ",".join(f["id"] for f in findings[start:start + 100])
        controls.extend(await repository.rows("compliance_violations", finding_id=f"in.({ids})"))
    locations = await repository.rows("finding_locations", snapshot_id=f"eq.{snapshot['id']}") if snapshot else []
    by_location = {location["finding_id"]: location for location in locations}
    for finding in findings:
        finding["violations"] = [control for control in controls if control["finding_id"] == finding["id"]]
        finding["location"] = by_location.get(finding["id"])
    job = await get_job(repository, scan_id)
    return JSONResponse({"scan": scan, "snapshot": snapshot, "findings": redact_evidence(findings), "metadata": job["result_metadata"] if job else {}, "events": job["events"] if job else []}, headers={"Cache-Control": "no-store"})


@router.get("/scans/{scan_id}/source")
async def source_info(scan_id: uuid.UUID, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    await repository.authorize(str(scan_id), token)
    return JSONResponse({"snapshot": await snapshot_state(repository, str(scan_id))}, headers={"Cache-Control": "no-store"})


async def ready_snapshot(repository, scan_id, token):
    await repository.authorize(scan_id, token)
    snapshot = await snapshot_state(repository, scan_id)
    if not snapshot:
        raise HTTPException(404, "Source unavailable for this audit — scan again to enable source browsing")
    if snapshot["state"] == "expired":
        raise HTTPException(410, "Source preview expired; findings and reports remain available")
    if snapshot["state"] != "ready" and not (settings.AUDIT_WORKBENCH_PROGRESSIVE_ENABLED and snapshot["state"] == "indexing"):
        raise HTTPException(409, "Source preview is not ready")
    return snapshot


@router.get("/scans/{scan_id}/source/files")
async def files(scan_id: uuid.UUID, q: str = Query("", max_length=150), offset: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=200), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    snapshot = await ready_snapshot(repository, str(scan_id), token)
    page = await file_page(repository, snapshot, token, q, offset, limit)
    return JSONResponse(page, headers={"Cache-Control": "no-store"})


FILE_FIELDS = "id,snapshot_id,path,language,byte_size,line_count,preview_state,redacted,reason"
SUMMARY_FIELDS = "id,scan_id,title,severity,cvss_score,cwe_id,file_path,line_number,source,state,created_at"


def literal_pattern(value):
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("*", "\\*") + "%"


async def file_page(repository, snapshot, token, q="", offset=0, limit=200):
    filters = {"snapshot_id": f"eq.{snapshot['id']}", "select": FILE_FIELDS, "order": "path.asc"}
    if q:
        filters["path"] = f"ilike.{literal_pattern(q)}"
    page = await repository.page("snapshot_files", offset=offset, limit=limit, token=token, **filters)
    # Defense in depth for adapters; never expose object paths or hashes.
    page["items"] = [{k: v for k, v in entry.items() if k in FILE_FIELDS.split(",")} for entry in page["items"]]
    return page


def finding_filters(scan_id, severity="all", q="", state="all"):
    filters = {"scan_id": f"eq.{scan_id}", "select": SUMMARY_FIELDS, "order": "severity.asc,created_at.asc,id.asc"}
    if severity != "all":
        filters["severity"] = f"eq.{severity}"
    if state != "all":
        filters["state"] = f"eq.{state}"
    if q:
        # Quoted operands prevent PostgREST filter grammar injection.
        pattern = literal_pattern(q).replace('"', '\\"')
        filters["or"] = "(" + ",".join(f'{field}.ilike."{pattern}"' for field in ("title", "description", "file_path", "cwe_id")) + ")"
    return filters


async def finding_page(repository, scan_id, token, severity="all", q="", offset=0, state="all"):
    filters = finding_filters(scan_id, severity, q, state)
    page = await repository.page("findings", token=token, offset=offset, limit=50, **filters)
    ids = ",".join(f["id"] for f in page["items"])
    locations = await repository.rows("finding_locations", finding_id=f"in.({ids})") if ids else []
    by_id = {l["finding_id"]: l for l in locations}
    page["items"] = [{**{k: v for k, v in f.items() if k in SUMMARY_FIELDS.split(",")}, "location": by_id.get(f["id"])} for f in page["items"]]
    return redact_evidence(page)


@router.get("/scans/{scan_id}/workbench/findings")
async def finding_summaries(scan_id: uuid.UUID, severity: str = Query("all", pattern="^(all|critical|high|medium|low)$"), q: str = Query("", max_length=150), offset: int = Query(0, ge=0), state: str = Query("all", pattern="^(all|open|resolved|accepted_risk|false_positive)$"), workspace_id: uuid.UUID | None = None, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    await repository.authorize(str(scan_id), token, str(workspace_id) if workspace_id else None)
    return JSONResponse(await finding_page(repository, str(scan_id), token, severity, q, offset, state), headers={"Cache-Control": "no-store"})


@router.get("/workspaces/{workspace_id}/finding-scans")
async def finding_scans(workspace_id: uuid.UUID, offset: int = Query(0, ge=0), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    if not await repository.role(str(workspace_id), token):
        raise HTTPException(404, "Workspace not found")
    page = await repository.page("scans", token=token, offset=offset, limit=100,
        workspace_id=f"eq.{workspace_id}", status="eq.completed",
        select="id,workspace_id,target_name,status,created_at,completed_at",
        order="created_at.desc,id.desc")
    return JSONResponse(page, headers={"Cache-Control": "no-store"})


@router.get("/scans/{scan_id}/workbench/findings/counts")
async def finding_counts(scan_id: uuid.UUID, workspace_id: uuid.UUID, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    await repository.authorize(str(scan_id), token, str(workspace_id))
    counts = await repository.rest("POST", "rpc/audit_workbench_counts", body={"p_scan_id": str(scan_id)}, token=token)
    return JSONResponse({"total": counts["total"], "severity": counts["severity"]}, headers={"Cache-Control": "no-store"})


def csv_cell(value):
    text = "" if value is None else str(value)
    # Quoting alone does not prevent spreadsheet formula execution.
    if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
        return "'" + text
    return text


@router.get("/scans/{scan_id}/workbench/findings/export")
async def export_finding_queue(scan_id: uuid.UUID, workspace_id: uuid.UUID, format: Literal["csv", "json"] = "csv", severity: str = Query("all", pattern="^(all|critical|high|medium|low)$"), state: str = Query("all", pattern="^(all|open|resolved|accepted_risk|false_positive)$"), q: str = Query("", max_length=150), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    scan = await repository.authorize(str(scan_id), token, str(workspace_id))
    if scan["status"] != "completed":
        raise HTTPException(409, "Wait for the scan to complete before exporting")
    filters = finding_filters(str(scan_id), severity, q, state)
    fields = SUMMARY_FIELDS + ",description,code_snippet,remediation,cve_id,cvss_vector,updated_at"
    filters["select"] = fields
    items = []
    offset, expected_total = 0, None
    while offset < 20000:
        page = await repository.page("findings", token=token, offset=offset, limit=500, **filters)
        if page["total"] > 20000:
            raise HTTPException(413, "Narrow the filters to export at most 20,000 findings")
        if expected_total is not None and expected_total != page["total"]:
            raise HTTPException(409, "Findings changed during export; please retry")
        expected_total = page["total"]
        # Explicit allowlist and read-time redaction also protect legacy scans.
        items.extend(redact_evidence([{k: v for k, v in f.items() if k in fields.split(",")} for f in page["items"]]))
        offset += len(page["items"])
        if offset >= page["total"]:
            break
        if not page["items"]:
            raise HTTPException(409, "Findings changed during export; please retry")
    if len(items) != expected_total or len({f["id"] for f in items}) != len(items):
        raise HTTPException(409, "Findings changed during export; please retry")
    await repository.authorize(str(scan_id), token, str(workspace_id))
    headers = {"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="findings-{scan_id}.{format}"'}
    if format == "json":
        return JSONResponse(items, headers=headers)
    output = io.StringIO(newline="")
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    columns = ("title", "severity", "state", "cwe_id", "cve_id", "file_path", "line_number", "cvss_score", "remediation")
    writer.writerow(columns)
    writer.writerows([csv_cell(f.get(column)) for column in columns] for f in items)
    return Response("\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/scans/{scan_id}/workbench/findings/{finding_id}")
async def finding_detail(scan_id: uuid.UUID, finding_id: uuid.UUID, workspace_id: uuid.UUID | None = None, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    await repository.authorize(str(scan_id), token, str(workspace_id) if workspace_id else None)
    entries = await repository.rest("GET", "findings", params={"id": f"eq.{finding_id}", "scan_id": f"eq.{scan_id}"}, token=token)
    if not entries:
        raise HTTPException(404, "Finding not found")
    controls, locations = await asyncio.gather(
        repository.rest("GET", "compliance_violations", params={"finding_id": f"eq.{finding_id}"}, token=token),
        repository.rest("GET", "finding_locations", params={"finding_id": f"eq.{finding_id}"}, token=token))
    location = locations[0] if locations else None
    file = None
    if location and location.get("file_id"):
        entries_file = await repository.rows("snapshot_files", id=f"eq.{location['file_id']}", snapshot_id=f"eq.{location['snapshot_id']}", select=FILE_FIELDS)
        file = {k: v for k, v in entries_file[0].items() if k in FILE_FIELDS.split(",")} if entries_file else None
    return JSONResponse(redact_evidence({"finding": {**entries[0], "violations": controls, "location": location}, "file": file}), headers={"Cache-Control": "no-store"})


async def status_payload(repository, scan, token):
    snapshot, job, counts = await asyncio.gather(snapshot_state(repository, scan["id"]), get_job(repository, scan["id"]), repository.rest("POST", "rpc/audit_workbench_counts", body={"p_scan_id": scan["id"]}, token=token))
    return {"scan": scan, "snapshot": snapshot, "counts": counts, "metadata": job["result_metadata"] if job else {}, "events": job["events"] if job else [], "job_status": job["status"] if job else scan["status"]}


@router.get("/scans/{scan_id}/workbench/status")
async def workbench_status(scan_id: uuid.UUID, workspace_id: uuid.UUID | None = None, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    scan = await repository.authorize(str(scan_id), token, str(workspace_id) if workspace_id else None)
    return JSONResponse(await status_payload(repository, scan, token), headers={"Cache-Control": "no-store"})


@router.get("/scans/{scan_id}/workbench/bootstrap")
async def bootstrap(scan_id: uuid.UUID, workspace_id: uuid.UUID | None = None, token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    started = perf_counter()
    scan = await repository.authorize(str(scan_id), token, str(workspace_id) if workspace_id else None)
    payload = await status_payload(repository, scan, token)
    snapshot = payload["snapshot"]
    file_result, findings_result = await asyncio.gather(file_page(repository, snapshot, token) if snapshot and snapshot["state"] in {"ready", "indexing"} else asyncio.sleep(0, result={"items": [], "total": 0}), finding_page(repository, str(scan_id), token))
    payload.update(files=file_result, finding_page=findings_result, findings=findings_result["items"], initial_source=None, initial_file=None)
    first = next((f for f in file_result["items"] if f["preview_state"] == "ready"), None)
    if not first and snapshot and snapshot["state"] in {"ready", "indexing"}:
        available = await repository.rows("snapshot_files", snapshot_id=f"eq.{snapshot['id']}", preview_state="eq.ready", order="path.asc", limit=1)
        first = available[0] if available else None
    if first and snapshot["state"] in {"ready", "indexing"}:
        try:
            private_file = await repository.rows("snapshot_files", id=f"eq.{first['id']}", snapshot_id=f"eq.{snapshot['id']}")
            if private_file and private_file[0]["preview_state"] == "ready" and private_file[0].get("object_path"):
                payload["initial_source"] = await source_window(repository, snapshot, private_file[0], 1, 1000)
                payload["initial_file"] = {k: v for k, v in private_file[0].items() if k in FILE_FIELDS.split(",")}
        except HTTPException as exc:
            if exc.status_code not in {410, 413}:
                raise
    payload["bootstrap_seconds"] = round(perf_counter() - started, 4)
    return JSONResponse(payload, headers={"Cache-Control": "no-store"})


@router.get("/scans/{scan_id}/source/files/{file_id}")
async def file_content(scan_id: uuid.UUID, file_id: uuid.UUID, start: int = Query(1, ge=1), lines: int = Query(1000, ge=1, le=1000), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    snapshot = await ready_snapshot(repository, str(scan_id), token)
    entries = await repository.rows("snapshot_files", id=f"eq.{file_id}", snapshot_id=f"eq.{snapshot['id']}")
    if not entries:
        raise HTTPException(404, "File not found")
    entry = entries[0]
    if entry["preview_state"] == "pending":
        raise HTTPException(409, "Preparing preview — this file is not ready yet")
    if entry["preview_state"] != "ready" or not entry.get("object_path"):
        raise HTTPException(422, entry.get("reason") or "No preview is available for this file")
    return JSONResponse(await source_window(repository, snapshot, entry, start, lines), headers={"Cache-Control": "no-store"})


async def source_window(repository, snapshot, entry, start, lines):
    if start > entry["line_count"]:
        raise HTTPException(416, "Source line is outside this file")
    stored_text = await repository.read_text(entry["object_path"])
    # Reapply current masking to older immutable snapshots as well as new uploads.
    text = redact_text(stored_text)
    selected, size = [], 0
    for line in text.split("\n")[start - 1:start - 1 + lines]:
        size += len(line.encode()) + 1
        if size > 262144:
            break
        selected.append(line)
    if not selected:
        raise HTTPException(413, "This line is too large for the source viewer")
    return {"id": entry["id"], "revision": snapshot["revision"], "start_line": start, "end_line": start + len(selected) - 1, "total_lines": entry["line_count"], "language": entry["language"], "redacted": entry["redacted"] or text != stored_text, "content": "\n".join(selected)}


@router.get("/scans/{scan_id}/source/search")
async def search(scan_id: uuid.UUID, q: str = Query(..., min_length=2, max_length=100), offset: int = Query(0, ge=0), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    snapshot = await ready_snapshot(repository, str(scan_id), token)
    entries = await repository.rows("snapshot_files", snapshot_id=f"eq.{snapshot['id']}", preview_state="eq.ready", order="path.asc")
    matches, scanned_bytes, processed = [], 0, 0
    batch = entries[offset:offset + 20]
    for entry in batch:
        text = redact_text(await repository.read_text(entry["object_path"]))
        processed += 1
        scanned_bytes += len(text.encode())
        for number, line in enumerate(text.split("\n"), 1):
            if q.casefold() in line.casefold():
                matches.append({"file_id": entry["id"], "path": entry["path"], "line_number": number, "preview": line[:240]})
                if len(matches) >= 100:
                    break
        if len(matches) >= 100 or scanned_bytes >= 2097152:
            break
    return JSONResponse({"items": matches, "truncated": len(matches) >= 100 or scanned_bytes >= 2097152, "next_offset": offset + processed if offset + processed < len(entries) else None}, headers={"Cache-Control": "no-store"})


@router.get("/scans/{scan_id}/workbench/report")
async def report(scan_id: uuid.UUID, workspace_id: uuid.UUID | None = None, frameworks: str | None = Query(None, max_length=150), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    from app.api.report_library import report_payload
    from app.report.generator import PdfBusy
    scan = await repository.authorize(str(scan_id), token, str(workspace_id) if workspace_id else None)
    if scan["status"] != "completed":
        raise HTTPException(409, "A completed audit is required for export")
    result = await report_payload(repository, scan, token, frameworks)
    # Never write authenticated evidence to the legacy unauthenticated report cache.
    try:
        response = await asyncio.to_thread(_generate_pdf_stream, str(scan_id), result, cache=False)
    except PdfBusy:
        raise HTTPException(503, "PDF preparation is busy; retry shortly", headers={"Retry-After": "5"})
    except Exception:
        raise HTTPException(503, "The PDF could not be prepared; retry shortly")
    await repository.authorize(str(scan_id), token, scan["workspace_id"])
    response.headers["Cache-Control"] = "no-store"
    return response


async def maintenance_once(repository):
    if settings.EXTENSION_REVIEW_ENABLED:
        await repository.rest("DELETE", "extension_declarations", params={"expires_at": f"lte.{now().isoformat()}"}, prefer="return=minimal")
        await repository.rest("DELETE", "extension_review_assets", params={"expires_at": f"lte.{now().isoformat()}"}, prefer="return=minimal")
    stale = await repository.rows("audit_workbench_jobs", status="eq.running", heartbeat_at=f"lt.{(now() - timedelta(minutes=3)).isoformat()}")
    for job in stale:
        # Conditional lease update prevents a heartbeat race from failing an active job.
        changed = await repository.rest("PATCH", "audit_workbench_jobs", params={"scan_id": f"eq.{job['scan_id']}", "heartbeat_at": f"eq.{job['heartbeat_at']}", "status": "eq.running"}, body={"status": "failed", "error_message": "Scan interrupted by a backend restart. Start a new audit to retry."})
        if changed:
            await repository.rest("PATCH", "scans", params={"id": f"eq.{job['scan_id']}", "status": "eq.running"}, body={"status": "failed", "error_code": "interrupted"})
            await repository.rest("PATCH", "source_snapshots", params={"scan_id": f"eq.{job['scan_id']}", "state": "eq.indexing"}, body={"state": "failed"})
    expired = await repository.rows("source_snapshots", expires_at=f"lte.{now().isoformat()}", state="neq.expired")
    failed = await repository.rows("source_snapshots", state="eq.failed")
    for snapshot in expired + failed:
        entries = await repository.rows("snapshot_files", snapshot_id=f"eq.{snapshot['id']}")
        await queue_source_paths(repository, entries)
        ids = [e["id"] for e in entries if e.get("object_path")]
        for offset in range(0, len(ids), 100):
            await repository.rest("PATCH", "snapshot_files", params={"snapshot_id": f"eq.{snapshot['id']}", "id": f"in.({','.join(ids[offset:offset + 100])})"}, body={"object_path": None, "preview_state": "expired"})
        if snapshot in expired:
            if settings.EXTENSION_REVIEW_ENABLED:
                await repository.rest("DELETE", "extension_declarations", params={"scan_id": f"eq.{snapshot['scan_id']}"}, prefer="return=minimal")
                await repository.rest("DELETE", "extension_review_assets", params={"scan_id": f"eq.{snapshot['scan_id']}"}, prefer="return=minimal")
            await repository.rest("PATCH", "source_snapshots", params={"id": f"eq.{snapshot['id']}"}, body={"state": "expired"})
    for entry in await repository.rows("source_cleanup_queue", order="enqueued_at.asc", limit=100):
        try:
            await repository.remove_text(entry["object_path"])
            await repository.rest("DELETE", "source_cleanup_queue", params={"object_path": f"eq.{entry['object_path']}"})
        except Exception:
            continue


async def maintenance_loop():
    while True:
        if settings.ADVISOR_HISTORY_ENABLED and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                from app.services.advisor_history import cleanup
                await cleanup(store())
            except Exception:
                logger.warning("Advisor history cleanup deferred; persistence unavailable")
        if settings.AUDIT_WORKBENCH_ENABLED and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                await maintenance_once(store())
            except Exception:
                logger.warning("Workbench maintenance deferred; persistence unavailable")
        if settings.GITHUB_ENABLED and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                from app.services.github_connection import cleanup_private_records
                await cleanup_private_records(store())
            except Exception:
                logger.warning("GitHub expiry cleanup deferred; persistence unavailable")
        await asyncio.sleep(60)
