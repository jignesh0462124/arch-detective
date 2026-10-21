"""
Export API — CSV and JSON download of scan findings.

GET /api/v1/scans/{scan_id}/export.csv   — CSV download (viewer+ role)
GET /api/v1/scans/{scan_id}/export.json  — JSON download (viewer+ role)

Security:
- CSV injection protection: prefix =, +, -, @ with single quote
- Authorization: workspace membership verified before any data is streamed
- UTF-8 BOM for Excel compatibility in CSV
"""
from __future__ import annotations

import csv
import io
import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import require_workspace_role
from app.database import get_db
from app.models.finding import Finding
from app.models.scan import Scan, ScanStatus
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser

router = APIRouter(tags=["export"])

# Cells starting with these chars are injection vectors in spreadsheet apps
_CSV_INJECTION_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_cell(value: object) -> str:
    """Escape CSV injection by prefixing dangerous cells with a single quote."""
    if value is None:
        return ""
    s = str(value)
    if s and s[0] in _CSV_INJECTION_PREFIXES:
        return "'" + s
    return s


async def _load_authorized_findings(
    scan_id: uuid.UUID,
    current_user: AuthenticatedUser,
    db: AsyncSession,
) -> tuple[Scan, list[Finding]]:
    """Load scan + findings, verifying workspace authorization."""
    scan_result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan: Scan | None = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")

    await require_workspace_role(
        db=db,
        user_id=uuid.UUID(current_user.id),
        workspace_id=scan.workspace_id,
        minimum_role=WorkspaceRole.VIEWER,
    )

    if scan.status != ScanStatus.COMPLETED:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot export: scan status is '{scan.status}'. Scan must be completed.",
        )

    findings_result = await db.execute(
        select(Finding).where(Finding.scan_id == scan_id).order_by(Finding.severity, Finding.created_at)
    )
    findings = list(findings_result.scalars().all())
    return scan, findings


@router.get("/scans/{scan_id}/export.csv", tags=["export"])
async def export_findings_csv(
    scan_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream findings as a CSV file with CSV injection protection."""
    scan, findings = await _load_authorized_findings(scan_id, current_user, db)

    async def generate() -> AsyncIterator[bytes]:
        buf = io.StringIO()
        # UTF-8 BOM for Excel compatibility
        buf.write("\ufeff")

        writer = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
        writer.writerow([
            "ID", "Title", "Severity", "Source", "CWE", "CVE",
            "File Path", "Line", "CVSS Score", "CVSS Vector",
            "Description", "Remediation", "State", "Created At",
        ])
        yield buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)

        for f in findings:
            writer.writerow([
                _sanitize_cell(f.id),
                _sanitize_cell(f.title),
                _sanitize_cell(f.severity),
                _sanitize_cell(f.source),
                _sanitize_cell(f.cwe_id),
                _sanitize_cell(f.cve_id),
                _sanitize_cell(f.file_path),
                _sanitize_cell(f.line_number),
                _sanitize_cell(f.cvss_score),
                _sanitize_cell(f.cvss_vector),
                _sanitize_cell(f.description),
                _sanitize_cell(f.remediation),
                _sanitize_cell(f.state),
                _sanitize_cell(f.created_at.isoformat() if f.created_at else ""),
            ])
            yield buf.getvalue().encode("utf-8")
            buf.seek(0)
            buf.truncate(0)

    filename = f"threatlens-{scan.target_name[:30].replace(' ', '-')}-findings.csv"
    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/scans/{scan_id}/export.json", tags=["export"])
async def export_findings_json(
    scan_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream findings as a JSON file."""
    scan, findings = await _load_authorized_findings(scan_id, current_user, db)

    def _finding_to_dict(f: Finding) -> dict:
        return {
            "id": str(f.id),
            "scan_id": str(f.scan_id),
            "title": f.title,
            "description": f.description,
            "severity": str(f.severity),
            "source": str(f.source),
            "cwe_id": f.cwe_id,
            "cve_id": f.cve_id,
            "file_path": f.file_path,
            "line_number": f.line_number,
            "code_snippet": f.code_snippet,
            "cvss_score": f.cvss_score,
            "cvss_vector": f.cvss_vector,
            "remediation": f.remediation,
            "fingerprint": f.fingerprint,
            "state": str(f.state),
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }

    payload = {
        "scan_id": str(scan_id),
        "target_name": scan.target_name,
        "scan_type": str(scan.scan_type),
        "exported_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "findings": [_finding_to_dict(f) for f in findings],
    }

    async def generate() -> AsyncIterator[bytes]:
        yield json.dumps(payload, indent=2, default=str).encode("utf-8")

    filename = f"threatlens-{scan.target_name[:30].replace(' ', '-')}-findings.json"
    return StreamingResponse(
        generate(),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
