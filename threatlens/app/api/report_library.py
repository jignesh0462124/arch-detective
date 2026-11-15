"""Read-only report library. Caller JWT/RLS is authoritative, including cache hits."""
from __future__ import annotations

import asyncio
import base64
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.api.audit_workbench import access_token, store
from app.ingestion.source_snapshot import redact_evidence
from app.storage.workbench_store import WorkbenchStore

router = APIRouter(tags=["report-library"])
FIELDS = "id,workspace_id,target_name,scan_type,status,created_at,completed_at,selected_frameworks,framework_scores"
LIMIT = 25
NO_STORE = {"Cache-Control": "no-store"}


async def workspace_access(repository, workspace, token):
    if not await repository.role(workspace, token):
        raise HTTPException(404, "Workspace not found")


def framework_scope(scan, frameworks=None):
    recorded = list(dict.fromkeys(scan.get("selected_frameworks") or []))
    selected = recorded if frameworks is None else list(dict.fromkeys(x.strip() for x in frameworks.split(",") if x.strip()))
    if not set(selected) <= set(recorded):
        raise HTTPException(422, "Select only frameworks assessed in this audit")
    return selected


def summary_item(scan, counts):
    return {**{key: scan.get(key) for key in FIELDS.split(",")}, "counts": counts,
            "framework_scores": scan.get("framework_scores") or {},
            "selected_frameworks": scan.get("selected_frameworks") or []}


def encode_cursor(scan):
    return base64.urlsafe_b64encode(json.dumps([scan["created_at"], scan["id"]]).encode()).decode().rstrip("=")


def cursor_filter(cursor):
    try:
        date, identifier = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        date = datetime.fromisoformat(date.replace("Z", "+00:00")).isoformat()
        identifier = str(uuid.UUID(identifier))
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise HTTPException(422, "Invalid report cursor")
    return f"or(created_at.lt.{date},and(created_at.eq.{date},id.lt.{identifier}))"


@router.get("/workspaces/{workspace_id}/report-library")
async def library(workspace_id: uuid.UUID, q: str = Query("", max_length=150), framework: str = Query("all", pattern="^(all|gdpr|soc2|iso27001|pci_dss|nist_csf)$"), cursor: str | None = Query(None, max_length=500), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    workspace = str(workspace_id)
    await workspace_access(repository, workspace, token)
    base = {"workspace_id": f"eq.{workspace}", "status": "eq.completed"}
    filters = {**base, "select": FIELDS, "order": "created_at.desc,id.desc"}
    if framework != "all":
        filters["selected_frameworks"] = f"cs.{{{framework}}}"
    if q.strip():
        text = q.strip().replace("\\", "\\\\").replace('"', '\\"').replace("%", "\\%").replace("_", "\\_").replace("*", "\\*")
        try:
            identifier = str(uuid.UUID(q.strip()))
            filters["or"] = f'(target_name.ilike."%{text}%",id.eq.{identifier})'
        except ValueError:
            filters["target_name"] = f"ilike.*{text}*"
    # Count before the cursor: matching totals must not shrink on later pages.
    predicate = cursor_filter(cursor) if cursor else None
    total_task = repository.page("scans", token=token, limit=0, **base, select="id")
    if cursor:
        matching_task = repository.page("scans", token=token, limit=0, **filters)
        page_filters = {**filters}
        if "or" in page_filters:
            predicate = f"{predicate},or{page_filters.pop('or')}"
        page_filters["and"] = f"({predicate})"
        page, matching, total = await asyncio.gather(repository.page("scans", token=token, limit=LIMIT, **page_filters), matching_task, total_task)
    else:
        page, total = await asyncio.gather(repository.page("scans", token=token, limit=LIMIT, **filters), total_task)
        matching = page
    ids = [s["id"] for s in page["items"]]
    counts = await repository.rest("POST", "rpc/report_scan_counts", token=token,
        body={"p_workspace_id": workspace, "p_scan_ids": ids}) if ids else {}
    await workspace_access(repository, workspace, token)
    return JSONResponse({"items": [summary_item(s, counts.get(s["id"], {"total": 0, "severity": {}})) for s in page["items"]],
        "total": matching["total"], "available_total": total["total"], "limit": LIMIT,
        "next_cursor": encode_cursor(page["items"][-1]) if len(ids) == LIMIT else None}, headers=NO_STORE)


async def resolve_scan(repository, workspace, reference, token):
    await workspace_access(repository, workspace, token)
    try:
        identifier = str(uuid.UUID(reference))
    except ValueError:
        # Old synthetic IDs used the first 16 scan-ID characters. Resolve via an
        # RLS-protected function, never interpolate a non-UUID into a UUID filter.
        if not reference.startswith("rep_") or len(reference) > 45:
            raise HTTPException(404, "Report not found")
        rows = await repository.rest("POST", "rpc/resolve_report_scan", token=token,
            body={"p_workspace_id": workspace, "p_reference": reference})
        if len(rows) != 1:
            raise HTTPException(404, "Report link is unavailable or ambiguous")
        identifier = rows[0]["id"]
    else:
        scans = await repository.rest("GET", "scans", token=token,
            params={"id": f"eq.{identifier}", "workspace_id": f"eq.{workspace}", "limit": 1})
        if not scans:
            reports = await repository.rest("GET", "reports", token=token,
                params={"id": f"eq.{identifier}", "select": "scan_id", "limit": 1})
            if not reports:
                raise HTTPException(404, "Report not found")
            identifier = reports[0]["scan_id"]
    scan = await repository.authorize(identifier, token, workspace)
    if scan["status"] != "completed":
        raise HTTPException(409, "A completed audit is required for reports")
    return scan


async def metadata(repository, scan, token):
    jobs = await repository.rest("GET", "audit_workbench_jobs", token=token,
        params={"scan_id": f"eq.{scan['id']}", "select": "status,result_metadata", "limit": 1})
    job = jobs[0] if jobs else None
    if job and job["status"] != "completed":
        raise HTTPException(409, "Wait for the audit results to finish saving")
    saved = (job or {}).get("result_metadata") or {}
    return {"summary": scan.get("summary") or saved.get("summary") or {},
            "analysis": saved.get("analysis") or (scan.get("summary") or {}).get("analysis") or {},
            "coverage": saved.get("coverage") or {}, "exclusions": saved.get("exclusions") or []}


@router.get("/workspaces/{workspace_id}/report-library/{reference}")
async def preview(workspace_id: uuid.UUID, reference: str, frameworks: str | None = Query(None, max_length=150), token: str = Depends(access_token), repository: WorkbenchStore = Depends(store)):
    scan = await resolve_scan(repository, str(workspace_id), reference, token)
    scope = framework_scope(scan, frameworks)
    counts, saved = await asyncio.gather(repository.rest("POST", "rpc/report_scan_counts", token=token,
        body={"p_workspace_id": str(workspace_id), "p_scan_ids": [scan["id"]]}), metadata(repository, scan, token))
    await repository.authorize(scan["id"], token, str(workspace_id))
    return JSONResponse(redact_evidence({**summary_item(scan, counts.get(scan["id"], {"total": 0, "severity": {}})),
        **saved, "frameworks": scope,
        "framework_scores": {k: v for k, v in (scan.get("framework_scores") or {}).items() if k in scope}}), headers=NO_STORE)


async def report_payload(repository, scan, token, frameworks=None):
    scope = framework_scope(scan, frameworks)
    saved = await metadata(repository, scan, token)
    findings, expected = [], None
    while len(findings) < 20000:
        page = await repository.page("findings", token=token, offset=len(findings), limit=500,
            scan_id=f"eq.{scan['id']}", order="id.asc")
        if page["total"] > 20000:
            raise HTTPException(413, "This audit exceeds the PDF finding limit")
        if expected is not None and page["total"] != expected:
            raise HTTPException(409, "Findings changed during export; retry")
        expected = page["total"]
        findings.extend(page["items"])
        if len(findings) >= expected:
            break
        if not page["items"]:
            raise HTTPException(409, "Findings changed during export; retry")
    if len(findings) != expected or len({f["id"] for f in findings}) != len(findings):
        raise HTTPException(409, "Findings changed during export; retry")
    by_finding = {}
    for start in range(0, len(findings), 100):
        ids = ",".join(f["id"] for f in findings[start:start + 100])
        offset = 0
        while True:
            page = await repository.page("compliance_violations", token=token, offset=offset, limit=500,
                finding_id=f"in.({ids})", order="id.asc")
            for control in page["items"]:
                if control.get("framework") in scope:
                    by_finding.setdefault(control["finding_id"], []).append(control)
            offset += len(page["items"])
            if offset >= page["total"]:
                break
            if not page["items"]:
                raise HTTPException(409, "Control mappings changed; retry")
    for finding in findings:
        finding["violations"] = by_finding.get(finding["id"], [])
        finding["remediation_steps"] = (finding.get("remediation") or "").splitlines()
    extension = None
    if (scan.get("source_config") or {}).get("review_kind") == "extension":
        reviews = await repository.rest("GET", "extension_reviews", token=token, params={"scan_id": f"eq.{scan['id']}", "limit": 1})
        if not reviews:
            raise HTTPException(409, "Extension policy results are unavailable; retry the report")
        policies = []
        for start in range(0, 2000, 500):
            page = await repository.page("extension_policy_results", token=token, offset=start, limit=500,
                scan_id=f"eq.{scan['id']}", order="store.asc,rule_id.asc,id.asc")
            if page["total"] > 2000:
                raise HTTPException(413, "Extension policy report exceeds the result limit")
            policies.extend(page["items"])
            if len(policies) >= page["total"]:
                break
        declarations = await repository.rest("GET", "extension_declarations", token=token, params={"scan_id": f"eq.{scan['id']}", "limit": 1})
        extension = {**reviews[0], "results": policies, "declarations": declarations[0]["content"] if declarations else None}
    return redact_evidence({**saved, "extension_review": extension, "workspace_id": scan["workspace_id"], "target_name": scan["target_name"],
        "scan_type": scan.get("scan_type"), "frameworks": scope,
        "framework_scores": {k: v for k, v in (scan.get("framework_scores") or {}).items() if k in scope},
        "audit_completed_at": scan.get("completed_at") or scan.get("created_at"), "findings": findings})
