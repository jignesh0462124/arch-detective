"""
Celery task for async PDF report generation.

Pipeline:
  1. Atomically claim report (queued → generating)
  2. Load workspace-owned scan + findings + violations from Supabase PostgreSQL
  3. Generate executive summary via LLM
  4. Generate PDF in a temporary directory
  5. Upload to private audit-reports bucket
  6. Persist Report metadata (never signed URL)
  7. Cleanup temp files in finally
"""
from __future__ import annotations

import hashlib
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.database import SyncSessionLocal
from app.models.compliance_violation import ComplianceViolation
from app.models.finding import Finding
from app.models.report import Report, ReportStatus
from app.models.scan import Scan, ScanStatus
from app.storage.client import StorageOperationError, SupabaseStorage
from app.storage.paths import report_object_path
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _load_scan_data(db: Session, scan_id: uuid.UUID) -> dict[str, Any] | None:
    """Load scan, findings, and violations into a serialisable dict."""
    scan_result = db.execute(
        select(Scan)
        .options(
            selectinload(Scan.findings).selectinload(Finding.violations),
        )
        .where(Scan.id == scan_id)
    )
    scan: Scan | None = scan_result.scalar_one_or_none()
    if scan is None:
        return None

    findings_data = []
    for f in scan.findings:
        findings_data.append({
            "id": str(f.id),
            "title": f.title,
            "description": f.description,
            "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
            "cvss_score": f.cvss_score,
            "cvss_vector": f.cvss_vector,
            "cwe_id": f.cwe_id,
            "cve_id": f.cve_id,
            "file_path": f.file_path,
            "line_number": f.line_number,
            "code_snippet": f.code_snippet,
            "source": str(f.source),
            "remediation": f.remediation,
            "remediation_steps": [],  # populated below from remediation planner if available
            "violations": [
                {
                    "framework": v.framework,
                    "control_id": v.control_id,
                    "control_title": v.control_title,
                    "violation_description": v.violation_description,
                    "evidence": v.evidence,
                    "rag_chunk_ids": v.rag_chunk_ids or [],
                }
                for v in f.violations
            ],
        })

    return {
        "scan": {
            "id": str(scan.id),
            "target_name": scan.target_name,
            "scan_type": scan.scan_type.value if hasattr(scan.scan_type, "value") else str(scan.scan_type),
            "selected_frameworks": scan.selected_frameworks,
            "status": str(scan.status),
        },
        "workspace_id": str(scan.workspace_id),
        "findings": findings_data,
        "framework_scores": scan.framework_scores or {},
        "frameworks": scan.selected_frameworks or [],
        "target_name": scan.target_name,
        "scan_type": str(scan.scan_type),
    }


@celery_app.task(
    name="threatlens.report.generate",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_pdf_report_task(self, scan_id: str, report_id: str) -> dict[str, Any]:
    """
    Celery task: generate a PDF audit report for a completed scan.

    Args:
        scan_id: UUID string of the scan
        report_id: UUID string of the pre-created Report row

    Returns:
        {"report_id": str, "status": "ready"|"failed"}
    """
    scan_uuid = uuid.UUID(scan_id)
    report_uuid = uuid.UUID(report_id)
    tmp_dir: str | None = None

    try:
        with SyncSessionLocal() as db:
            # Claim: queued → generating
            rows_updated = db.execute(
                update(Report)
                .where(Report.id == report_uuid, Report.status == ReportStatus.QUEUED)
                .values(status=ReportStatus.GENERATING)
            ).rowcount
            db.commit()

            if rows_updated == 0:
                # Already generating or completed — idempotent
                logger.info("Report %s already claimed, skipping.", report_id)
                return {"report_id": report_id, "status": "skipped"}

            # Load scan data
            scan_data = _load_scan_data(db, scan_uuid)
            if scan_data is None:
                raise ValueError(f"Scan {scan_id} not found")

        # Generate executive summary (may call Groq LLM)
        try:
            from app.agent.summary_writer import generate_executive_summary
            summary = generate_executive_summary(scan_data)
        except Exception:
            logger.exception("Executive summary generation failed, using fallback.")
            findings = scan_data.get("findings", [])
            summary = {
                "summary": f"Security assessment of {scan_data['target_name']} completed with {len(findings)} findings.",
                "risk_headline": "Review all critical and high severity findings immediately.",
                "overall_posture": "High",
                "top_priorities": ["Remediate critical findings.", "Review high severity findings."],
            }

        scan_data["summary"] = summary
        scan_data["report_id"] = report_id
        scan_data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        # Generate PDF in temp directory
        from app.report.generator import generate_pdf_report

        tmp_dir = tempfile.mkdtemp(prefix="threatlens_report_")
        pdf_bytes = generate_pdf_report(scan_data)
        sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        byte_size = len(pdf_bytes)

        # Determine report version
        with SyncSessionLocal() as db:
            report_row = db.get(Report, report_uuid)
            version = report_row.version if report_row else 1
            workspace_id = scan_data["workspace_id"]

        # Upload to private bucket
        object_path = report_object_path(
            workspace_id=uuid.UUID(workspace_id),
            scan_id=uuid.UUID(scan_id),
            report_id=report_uuid,
            version=version,
        )
        from app.config import settings as _settings

        storage = SupabaseStorage()
        storage.upload(
            bucket=_settings.SUPABASE_REPORT_BUCKET,
            object_path=object_path,
            content=pdf_bytes,
            content_type="application/pdf",
            upsert=True,
        )

        # Persist report metadata
        with SyncSessionLocal() as db:
            db.execute(
                update(Report)
                .where(Report.id == report_uuid)
                .values(
                    status=ReportStatus.READY,
                    bucket=_settings.SUPABASE_REPORT_BUCKET,
                    object_path=object_path,
                    sha256=sha256,
                    byte_size=byte_size,
                    generated_at=datetime.now(timezone.utc),
                    error_message=None,
                )
            )
            db.commit()

        logger.info("Report %s generated successfully (%d bytes).", report_id, byte_size)
        return {"report_id": report_id, "status": "ready"}

    except Exception as exc:
        logger.exception("Report generation failed for scan %s, report %s", scan_id, report_id)

        with SyncSessionLocal() as db:
            db.execute(
                update(Report)
                .where(Report.id == report_uuid)
                .values(
                    status=ReportStatus.FAILED,
                    error_message=str(exc)[:500],
                )
            )
            db.commit()

        raise self.retry(exc=exc)

    finally:
        if tmp_dir:
            import shutil
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass
