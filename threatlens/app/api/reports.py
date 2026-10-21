"""
Reports API endpoints.

POST /api/v1/scans/{scan_id}/reports   — Queue PDF report generation (analyst+ role)
GET  /api/v1/reports/{report_id}        — Report metadata and status
GET  /api/v1/reports/{report_id}/download — Short-lived signed download URL (viewer+)
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import require_workspace_role
from app.config import settings
from app.database import get_db
from app.models.report import Report, ReportStatus
from app.models.scan import Scan, ScanStatus
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser
from app.storage.client import StorageOperationError, SupabaseStorage

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class ReportQueueResponse(BaseModel):
    report_id: uuid.UUID
    scan_id: uuid.UUID
    status: str = "queued"
    message: str = "PDF report generation queued."


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scan_id: uuid.UUID
    status: ReportStatus
    sha256: str | None
    byte_size: int | None
    version: int
    generated_at: str | None
    error_message: str | None


class ReportDownloadResponse(BaseModel):
    signed_url: str
    expires_in_seconds: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post(
    "/scans/{scan_id}/reports",
    response_model=ReportQueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["reports"],
)
async def queue_report(
    scan_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportQueueResponse:
    """Queue PDF generation for a completed scan (analyst+ role required)."""
    # Load scan and verify ownership
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan: Scan | None = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")

    await require_workspace_role(
        db=db,
        user_id=uuid.UUID(current_user.id),
        workspace_id=scan.workspace_id,
        minimum_role=WorkspaceRole.ANALYST,
    )

    if scan.status != ScanStatus.COMPLETED:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot generate report: scan status is '{scan.status}'. Scan must be completed.",
        )

    # Check for existing in-progress report (rate limit: 1 concurrent per scan)
    existing = await db.execute(
        select(Report).where(
            Report.scan_id == scan_id,
            Report.status.in_([ReportStatus.QUEUED, ReportStatus.GENERATING]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A report is already being generated for this scan.")

    # Determine next version
    version_result = await db.execute(
        select(Report.version).where(Report.scan_id == scan_id).order_by(Report.version.desc())
    )
    latest_version = version_result.scalar_one_or_none()
    next_version = (latest_version or 0) + 1

    # Create Report row with a placeholder path (task fills in the real one)
    report = Report(
        id=uuid.uuid4(),
        scan_id=scan_id,
        status=ReportStatus.QUEUED,
        bucket=settings.SUPABASE_REPORT_BUCKET,
        object_path=f"pending/{scan_id}/{uuid.uuid4()}",  # placeholder
        version=next_version,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Dispatch Celery task
    from app.tasks.report_task import generate_pdf_report_task

    generate_pdf_report_task.delay(str(scan_id), str(report.id))

    return ReportQueueResponse(report_id=report.id, scan_id=scan_id)


@router.get("/{report_id}", response_model=ReportResponse, tags=["reports"])
async def get_report(
    report_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Return report metadata and current status."""
    result = await db.execute(
        select(Report).join(Scan, Scan.id == Report.scan_id).where(Report.id == report_id)
    )
    report: Report | None = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    # Verify workspace membership (viewer+)
    scan_result = await db.execute(select(Scan).where(Scan.id == report.scan_id))
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=404, detail="Associated scan not found.")

    await require_workspace_role(
        db=db,
        user_id=uuid.UUID(current_user.id),
        workspace_id=scan.workspace_id,
        minimum_role=WorkspaceRole.VIEWER,
    )

    return ReportResponse(
        id=report.id,
        scan_id=report.scan_id,
        status=report.status,
        sha256=report.sha256,
        byte_size=report.byte_size,
        version=report.version,
        generated_at=report.generated_at.isoformat() if report.generated_at else None,
        error_message=report.error_message,
    )


@router.get("/{report_id}/download", response_model=ReportDownloadResponse, tags=["reports"])
async def get_report_download_url(
    report_id: uuid.UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDownloadResponse:
    """
    Authorize and return a short-lived signed download URL.
    The signed URL is never stored — generated fresh on each authorized request.
    """
    result = await db.execute(select(Report).where(Report.id == report_id))
    report: Report | None = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    if report.status != ReportStatus.READY:
        raise HTTPException(status_code=409, detail=f"Report is not ready (status: {report.status}).")

    scan_result = await db.execute(select(Scan).where(Scan.id == report.scan_id))
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=404, detail="Associated scan not found.")

    await require_workspace_role(
        db=db,
        user_id=uuid.UUID(current_user.id),
        workspace_id=scan.workspace_id,
        minimum_role=WorkspaceRole.VIEWER,
    )

    # Generate fresh signed URL — never stored
    try:
        storage = SupabaseStorage()
        signed_url = storage.create_signed_download_url(
            bucket=report.bucket,
            object_path=report.object_path,
            expires_in=settings.SIGNED_URL_TTL_SECONDS,
        )
    except StorageOperationError as exc:
        raise HTTPException(status_code=502, detail="Failed to generate download URL.") from exc

    return ReportDownloadResponse(
        signed_url=signed_url,
        expires_in_seconds=settings.SIGNED_URL_TTL_SECONDS,
    )
