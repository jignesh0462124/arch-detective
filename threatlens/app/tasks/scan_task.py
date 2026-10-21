"""
Full scan Celery task — wires the complete pipeline:

  0%  →  5% : Validate + load workspace/artifact from Supabase PostgreSQL
  5%  → 15% : Download artifact from private Storage → extract to temp dir
 15%  → 30% : Semgrep static analysis
 30%  → 40% : Bandit Python analysis
 40%  → 50% : Trufflehog secret scan
 50%  → 55% : Dependency audit (pip/npm)
 55%  → 70% : LLM deep code review (up to 30 files)
 70%  → 75% : Deduplicate findings → save to DB
 75%  → 95% : Compliance mapping per finding (RAG → LLM) + CVSS scoring
 95%  → 100%: Calculate framework scores → set completed

Security rules:
 - Task payload contains scan_id ONLY (no paths, credentials, source content)
 - Atomic queued→running claim prevents duplicate concurrent execution
 - Each scanner wrapped in individual try/except (one failure ≠ scan failure)
 - Scanner subprocesses receive NO infrastructure credentials
 - All temp dirs cleaned in finally block
"""
from __future__ import annotations

import hashlib
import logging
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import update
from sqlalchemy.orm import selectinload

from app.database import SyncSessionLocal
from app.models.finding import Finding, FindingSource, FindingState, Severity
from app.models.scan import Scan, ScanStatus, ScanType, SourceType
from app.models.scan_artifact import ArtifactKind, ArtifactStatus, ScanArtifact
from app.storage.client import StorageOperationError, SupabaseStorage
from app.storage.lifecycle import delete_object_if_present
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# ── Progress helpers ──────────────────────────────────────────────────────────


def _update_progress(
    scan_id: uuid.UUID,
    progress: int,
    finding_count: int | None = None,
    status: ScanStatus | None = None,
) -> None:
    """Persist scan progress to PostgreSQL (durable; Redis is only a transient cache)."""
    try:
        with SyncSessionLocal() as db:
            values: dict[str, Any] = {"progress": min(max(progress, 0), 100)}
            if finding_count is not None:
                values["finding_count"] = finding_count
            if status is not None:
                values["status"] = status.value
                if status == ScanStatus.RUNNING and "started_at" not in values:
                    values["started_at"] = datetime.now(timezone.utc)
                elif status in (ScanStatus.COMPLETED, ScanStatus.FAILED):
                    values["completed_at"] = datetime.now(timezone.utc)
            db.execute(update(Scan).where(Scan.id == scan_id).values(**values))
            db.commit()
    except Exception:
        logger.exception("Failed to update progress for scan %s", scan_id)


def _set_failed(scan_id: uuid.UUID, error_code: str, error_message: str) -> None:
    try:
        with SyncSessionLocal() as db:
            db.execute(
                update(Scan)
                .where(Scan.id == scan_id)
                .values(
                    status=ScanStatus.FAILED.value,
                    error_code=error_code[:64],
                    error_message=error_message[:500],
                    completed_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
    except Exception:
        logger.exception("Failed to mark scan %s as failed", scan_id)


# ── Finding persistence ───────────────────────────────────────────────────────


def _save_findings(scan_id: uuid.UUID, findings: list[Any]) -> int:
    """Persist deduplicated findings, return saved count."""
    if not findings:
        return 0

    from app.scanners.normalization import finding_fingerprint

    saved = 0
    with SyncSessionLocal() as db:
        for f in findings:
            # Canonical fingerprint (source+title+path+line+CWE) — shared with scanners/normalization.
            existing_fp = getattr(f, "fingerprint", None)
            if existing_fp:
                fingerprint = existing_fp
            else:
                fingerprint = finding_fingerprint(
                    source=f.source,
                    title=str(getattr(f, "title", "")),
                    file_path=getattr(f, "file_path", None),
                    line_number=getattr(f, "line_number", None),
                    cwe_id=getattr(f, "cwe_id", None),
                )

            # Check for existing finding with same fingerprint in this scan
            from sqlalchemy import select as sa_select
            existing = db.execute(
                sa_select(Finding).where(
                    Finding.scan_id == scan_id,
                    Finding.fingerprint == fingerprint,
                )
            ).scalar_one_or_none()

            if existing:
                # Keep highest severity
                sev_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
                existing_rank = sev_rank.get(str(existing.severity).lower(), 0)
                new_rank = sev_rank.get(str(f.severity).lower(), 0) if hasattr(f, "severity") else 0
                if new_rank > existing_rank:
                    existing.severity = f.severity
                    existing.cvss_score = getattr(f, "cvss_score", None)
                    db.add(existing)
                continue

            finding = Finding(
                id=uuid.uuid4(),
                scan_id=scan_id,
                title=f.title,
                description=f.description,
                severity=f.severity,
                cwe_id=getattr(f, "cwe_id", None),
                cve_id=getattr(f, "cve_id", None),
                file_path=getattr(f, "file_path", None),
                line_number=getattr(f, "line_number", None),
                code_snippet=getattr(f, "code_snippet", None),
                source=f.source,
                remediation=getattr(f, "remediation", None),
                fingerprint=fingerprint,
                state=FindingState.OPEN,
            )
            db.add(finding)
            saved += 1

        db.commit()
    return saved


# ── Framework score calculation ───────────────────────────────────────────────


def _calculate_framework_scores(
    scan_id: uuid.UUID,
    selected_frameworks: list[str],
) -> dict[str, int]:
    """
    Score = 100 - (weighted_violation_penalty).
    Critical violations -10, High -7, Medium -4, Low -2.
    """
    with SyncSessionLocal() as db:
        from sqlalchemy import select as sa_select
        from app.models.compliance_violation import ComplianceViolation

        findings = db.execute(
            sa_select(Finding)
            .options(selectinload(Finding.violations))
            .where(Finding.scan_id == scan_id)
        ).scalars().all()

    sev_penalty = {"critical": 10, "high": 7, "medium": 4, "low": 2}
    penalties: dict[str, int] = {fw: 0 for fw in selected_frameworks}

    for finding in findings:
        penalty = sev_penalty.get(str(finding.severity).lower(), 2)
        for v in finding.violations:
            fw = v.framework.lower()
            if fw in penalties:
                penalties[fw] = penalties[fw] + penalty

    scores = {}
    for fw in selected_frameworks:
        raw = max(0, 100 - penalties.get(fw, 0))
        scores[fw] = raw

    return scores


# ── Main Celery task ──────────────────────────────────────────────────────────

@celery_app.task(
    name="threatlens.scan.run_full",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def run_full_scan(self, scan_id: str) -> dict[str, Any]:
    """
    Run the complete ThreatLens scan pipeline.
    Payload: scan_id string only.
    """
    scan_uuid = uuid.UUID(scan_id)
    tmp_dir: str | None = None

    try:
        # ── 0-5%: Load and atomically claim scan ──────────────────────────────
        _update_progress(scan_uuid, 0)
        with SyncSessionLocal() as db:
            result = db.execute(
                update(Scan)
                .where(Scan.id == scan_uuid, Scan.status == ScanStatus.QUEUED)
                .values(status=ScanStatus.RUNNING, started_at=datetime.now(timezone.utc))
                .returning(Scan.id)
            )
            claimed = result.scalar_one_or_none()
            db.commit()

        if claimed is None:
            logger.warning("Scan %s not in queued state — possible duplicate. Skipping.", scan_id)
            return {"scan_id": scan_id, "status": "skipped"}

        # Load full scan record
        with SyncSessionLocal() as db:
            from sqlalchemy import select as sa_select
            scan_result = db.execute(
                sa_select(Scan)
                .options(selectinload(Scan.artifacts))
                .where(Scan.id == scan_uuid)
            )
            scan: Scan | None = scan_result.scalar_one_or_none()
            if scan is None:
                raise ValueError(f"Scan {scan_id} not found after claiming.")

            workspace_id = scan.workspace_id
            scan_type = scan.scan_type
            source_type = scan.source_type
            target_name = scan.target_name
            selected_frameworks = list(scan.selected_frameworks or [])
            source_config = dict(scan.source_config or {})

            # Find the primary artifact
            primary_artifact: ScanArtifact | None = next(
                (a for a in scan.artifacts if a.status == ArtifactStatus.VERIFIED), None
            )
            if primary_artifact is None:
                primary_artifact = next(iter(scan.artifacts), None)

        _update_progress(scan_uuid, 5, status=ScanStatus.RUNNING)

        all_findings: list[Any] = []
        repo_path: str | None = None

        # ── 5-15%: Extract source ────────────────────────────────────────────
        _update_progress(scan_uuid, 5)

        if source_type == SourceType.GIT:
            git_url = source_config.get("git_url")
            if not git_url:
                raise ValueError("Git scan missing git_url in source_config")
            from app.ingestion.code_extractor import extract_from_git
            tmp_dir = tempfile.mkdtemp(prefix="threatlens_git_")
            repo_path = extract_from_git(str(git_url))
            # extract_from_git manages its own temp dir; drop ours to avoid leak.
            shutil.rmtree(tmp_dir, ignore_errors=True)
            tmp_dir = None

        elif primary_artifact is not None:
            # Download artifact from private Storage
            storage = SupabaseStorage()
            max_bytes = 1024 * 1024 * 200  # 200MB
            tmp_dir = tempfile.mkdtemp(prefix="threatlens_upload_")
            local_file = str(Path(tmp_dir) / "artifact.zip")
            storage.download_to_path_and_hash(
                bucket=primary_artifact.bucket,
                object_path=primary_artifact.object_path,
                destination=local_file,
                maximum_bytes=max_bytes,
            )

            artifact_kind = primary_artifact.kind
            if artifact_kind == ArtifactKind.CODE_ZIP:
                from app.ingestion.code_extractor import extract_from_zip
                repo_path = extract_from_zip(local_file)

        _update_progress(scan_uuid, 15)

        # ── 15-30%: Semgrep ──────────────────────────────────────────────────
        if repo_path and scan_type in (ScanType.CODEBASE, ScanType.FULL):
            try:
                from app.scanners.semgrep_runner import run_semgrep
                semgrep_findings = run_semgrep(repo_path)
                all_findings.extend(semgrep_findings)
                logger.info("Semgrep: %d findings", len(semgrep_findings))
            except Exception:
                logger.exception("Semgrep failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 30)

        # ── 30-40%: Bandit ───────────────────────────────────────────────────
        if repo_path and scan_type in (ScanType.CODEBASE, ScanType.FULL):
            try:
                from app.scanners.bandit_runner import run_bandit
                bandit_findings = run_bandit(repo_path)
                all_findings.extend(bandit_findings)
                logger.info("Bandit: %d findings", len(bandit_findings))
            except Exception:
                logger.exception("Bandit failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 40)

        # ── 40-50%: Trufflehog ───────────────────────────────────────────────
        if repo_path:
            try:
                from app.scanners.trufflehog_runner import run_trufflehog
                trufflehog_findings = run_trufflehog(repo_path)
                all_findings.extend(trufflehog_findings)
                logger.info("Trufflehog: %d findings", len(trufflehog_findings))
            except Exception:
                logger.exception("Trufflehog failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 50)

        # ── 50-55%: Dependency audit ─────────────────────────────────────────
        if repo_path:
            try:
                from app.scanners.dependency_audit import run_npm_audit, run_pip_audit
                pip_findings = run_pip_audit(repo_path)
                npm_findings = run_npm_audit(repo_path)
                all_findings.extend(pip_findings)
                all_findings.extend(npm_findings)
                logger.info("Dependency audit: %d findings", len(pip_findings) + len(npm_findings))
            except Exception:
                logger.exception("Dependency audit failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 55)

        # ── 55-70%: LLM code review ──────────────────────────────────────────
        if repo_path and scan_type in (ScanType.CODEBASE, ScanType.FULL):
            try:
                from app.ingestion.code_extractor import collect_source_files
                from app.scanners.llm_code_reviewer import llm_review_file
                source_files = collect_source_files(repo_path)
                # Cap at 30 files
                reviewable = [f for f in source_files if f.get("size_bytes", 0) > 0][:30]
                llm_findings: list[Any] = []
                for i, file_info in enumerate(reviewable):
                    try:
                        file_findings = llm_review_file(
                            file_path=file_info["path"],
                            content=file_info.get("content", ""),
                        )
                        llm_findings.extend(file_findings)
                    except Exception:
                        logger.warning("LLM review failed for file %s", file_info.get("path"))
                    # Update progress proportionally through 55→70%
                    sub_progress = 55 + int(15 * (i + 1) / max(len(reviewable), 1))
                    _update_progress(scan_uuid, sub_progress)

                all_findings.extend(llm_findings)
                logger.info("LLM review: %d findings from %d files", len(llm_findings), len(reviewable))
            except Exception:
                logger.exception("LLM review failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 70)

        # ── 70-75%: Deduplicate + save findings ──────────────────────────────
        saved_count = _save_findings(scan_uuid, all_findings)
        _update_progress(scan_uuid, 75, finding_count=saved_count)
        logger.info("Saved %d deduplicated findings for scan %s", saved_count, scan_id)

        # ── 75-95%: Compliance mapping per finding ────────────────────────────
        with SyncSessionLocal() as db:
            from sqlalchemy import select as sa_select
            db_findings = db.execute(
                sa_select(Finding).where(Finding.scan_id == scan_uuid)
            ).scalars().all()

        try:
            from app.agent.compliance_mapper import map_finding_to_compliance, persist_violations
            from app.agent.cvss_scorer import score_finding

            total = len(db_findings)
            for i, finding in enumerate(db_findings):
                try:
                    # CVSS scoring
                    cvss_score, cvss_vector = score_finding({
                        "title": finding.title,
                        "description": finding.description,
                        "severity": str(finding.severity),
                        "cwe_id": finding.cwe_id,
                        "code_snippet": finding.code_snippet,
                    })

                    # Compliance mapping
                    result = map_finding_to_compliance(finding, selected_frameworks)

                    # Persist CVSS + violations
                    with SyncSessionLocal() as db:
                        db.execute(
                            update(Finding)
                            .where(Finding.id == finding.id)
                            .values(
                                cvss_score=cvss_score,
                                cvss_vector=cvss_vector,
                                remediation=result.remediation_steps[0] if result.remediation_steps else finding.remediation,
                            )
                        )
                        db.commit()
                        persist_violations(db, finding.id, result)

                except Exception:
                    logger.exception("Compliance mapping failed for finding %s (continuing)", finding.id)

                # Progress 75→95%
                sub_progress = 75 + int(20 * (i + 1) / max(total, 1))
                _update_progress(scan_uuid, sub_progress, finding_count=saved_count)

        except Exception:
            logger.exception("Compliance mapping phase failed for scan %s (continuing)", scan_id)

        _update_progress(scan_uuid, 95)

        # ── 95-100%: Framework scores + complete ─────────────────────────────
        framework_scores = _calculate_framework_scores(scan_uuid, selected_frameworks)

        # Final count
        with SyncSessionLocal() as db:
            from sqlalchemy import func, select as sa_select
            count_result = db.execute(
                sa_select(func.count(Finding.id)).where(Finding.scan_id == scan_uuid)
            )
            final_count = count_result.scalar_one_or_none() or saved_count

        with SyncSessionLocal() as db:
            db.execute(
                update(Scan)
                .where(Scan.id == scan_uuid)
                .values(
                    status=ScanStatus.COMPLETED.value,
                    progress=100,
                    finding_count=final_count,
                    framework_scores=framework_scores,
                    completed_at=datetime.now(timezone.utc),
                )
            )
            db.commit()

        # Schedule source artifact cleanup after retention window
        try:
            from app.config import settings as _settings

            cleanup_scan_inputs.apply_async(
                args=[scan_id],
                countdown=3600 * max(0, _settings.SOURCE_RETENTION_HOURS),
            )
        except Exception:
            logger.warning("Failed to schedule source cleanup for scan %s", scan_id)

        logger.info(
            "Scan %s completed: %d findings, scores=%s",
            scan_id, final_count, framework_scores,
        )
        return {"scan_id": scan_id, "status": "completed", "finding_count": final_count}

    except Exception as exc:
        logger.exception("run_full_scan failed for scan %s", scan_id)
        _set_failed(scan_uuid, error_code="scan_error", error_message=str(exc))
        raise self.retry(exc=exc)

    finally:
        if tmp_dir:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass


# ── Stub (ingest_scan) kept for backward compat with older scan/start flow ───

@celery_app.task(name="threatlens.scan.ingest")
def ingest_scan(scan_id: str) -> dict[str, str]:
    """Deprecated: use run_full_scan instead. Kept for backward compat."""
    result = run_full_scan.delay(scan_id)
    return {"scan_id": scan_id, "status": "queued", "task_id": str(result.id)}


# ── Cleanup task ──────────────────────────────────────────────────────────────

@celery_app.task(
    name="threatlens.scan.cleanup_inputs",
    autoretry_for=(StorageOperationError,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)
def cleanup_scan_inputs(scan_id: str) -> dict[str, object]:
    """Delete private scan-inputs Storage objects after the retention window."""
    import asyncio

    scan_uuid = uuid.UUID(scan_id)
    storage = SupabaseStorage()
    deleted_count = 0

    with SyncSessionLocal() as db:
        from sqlalchemy import select as sa_select
        artifacts = db.execute(
            sa_select(ScanArtifact).where(ScanArtifact.scan_id == scan_uuid)
        ).scalars().all()
        for artifact in artifacts:
            try:
                delete_object_if_present(storage, artifact.bucket, artifact.object_path)
                deleted_count += 1
            except Exception:
                logger.exception("Failed to delete artifact %s", artifact.id)

    return {"scan_id": scan_id, "artifacts_deleted": deleted_count}


# Alias for backward compatibility
cleanup_scan = cleanup_scan_inputs


# ── NVD CVE sync (Beat schedule) ─────────────────────────────────────────────

@celery_app.task(name="threatlens.rag.sync_nvd_cves")
def sync_nvd_cves() -> dict[str, Any]:
    """Weekly task: fetch latest NVD CVEs and upsert into Qdrant."""
    try:
        import subprocess, sys
        result = subprocess.run(
            [sys.executable, "scripts/sync_nvd.py"],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(Path(__file__).parent.parent.parent),
        )
        return {"status": "ok", "stdout": result.stdout[-500:]}
    except Exception as exc:
        logger.exception("NVD sync failed")
        return {"status": "error", "error": str(exc)}
