from __future__ import annotations

import asyncio
import tempfile
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import ROLE_RANK, get_workspace_role, require_workspace_role
from app.config import settings
from app.database import get_db
from app.ingestion.code_extractor import GitSecurityError, validate_public_git_url
from app.models.scan import Scan, ScanStatus, SourceType
from app.models.scan_artifact import ArtifactStatus, ScanArtifact
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser
from app.schemas.scan import (
    ScanCreate,
    ScanCreateResponse,
    ScanDeleteResponse,
    ScanListResponse,
    ScanResponse,
    ScanStartRequest,
    ScanUploadContract,
)
from app.storage.client import (
    StorageConfigurationError,
    StorageObjectInfo,
    StorageOperationError,
    StorageSizeLimitError,
    SupabaseStorage,
)
from app.storage.paths import sanitize_filename, scan_input_object_path
from app.tasks.scan_task import cleanup_scan, ingest_scan

router = APIRouter(prefix="/scans", tags=["scans"])


def get_scan_storage() -> SupabaseStorage:
    return SupabaseStorage()


def dispatch_ingestion(scan_id: UUID) -> str:
    result = ingest_scan.delay(str(scan_id))
    return str(result.id)


def dispatch_cleanup(scan_id: UUID) -> str:
    result = cleanup_scan.delay(str(scan_id))
    return str(result.id)


async def _load_scan(db: AsyncSession, scan_id: UUID) -> Scan:
    result = await db.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


async def _authorize_scan(
    db: AsyncSession,
    scan: Scan,
    user_id: UUID,
    minimum_role: WorkspaceRole,
) -> WorkspaceRole:
    role = await get_workspace_role(db, scan.workspace_id, user_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    if ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient workspace permissions",
        )
    return role


async def _record_dispatch_failure(db: AsyncSession, scan: Scan) -> None:
    scan.status = ScanStatus.FAILED
    scan.error_code = "queue_unavailable"
    scan.error_message = "The scan queue is temporarily unavailable"
    await db.commit()


async def _dispatch_after_commit(db: AsyncSession, scan: Scan) -> None:
    try:
        task_id = dispatch_ingestion(scan.id)
    except Exception as exc:
        await _record_dispatch_failure(db, scan)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scan queue is temporarily unavailable",
        ) from exc
    scan.celery_task_id = task_id
    await db.commit()


def _upload_contract(artifact: ScanArtifact) -> ScanUploadContract:
    endpoint = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/upload/resumable"
    return ScanUploadContract(
        endpoint=endpoint,
        bucket=artifact.bucket,
        object_path=artifact.object_path,
        max_file_size=settings.MAX_FILE_SIZE_MB * 1024 * 1024,
    )


@router.post("", response_model=ScanCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    request: ScanCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanCreateResponse:
    await require_workspace_role(
        db,
        request.workspace_id,
        user.id,
        WorkspaceRole.ANALYST,
    )
    if (
        request.source_type is SourceType.UPLOAD
        and request.byte_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024
    ):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload exceeds the configured size limit",
        )

    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        workspace_id=request.workspace_id,
        created_by=user.id,
        scan_type=request.scan_type,
        source_type=request.source_type,
        target_name=request.target_name.strip(),
        selected_frameworks=request.frameworks,
        status=ScanStatus.UPLOADING
        if request.source_type is SourceType.UPLOAD
        else ScanStatus.QUEUED,
    )
    artifact: ScanArtifact | None = None

    if request.source_type is SourceType.UPLOAD:
        artifact_id = uuid.uuid4()
        filename = sanitize_filename(request.filename)
        object_path = scan_input_object_path(
            request.workspace_id,
            scan_id,
            artifact_id,
            filename,
        )
        artifact = ScanArtifact(
            id=artifact_id,
            scan_id=scan_id,
            kind=request.artifact_kind,
            bucket=settings.SUPABASE_SCAN_BUCKET,
            object_path=object_path,
            original_filename=filename,
            content_type=request.content_type.split(";", maxsplit=1)[0].strip().lower(),
            byte_size=request.byte_size,
            status=ArtifactStatus.PENDING,
        )
        scan.source_config = {
            "artifact_id": str(artifact_id),
            "bucket": artifact.bucket,
            "object_path": object_path,
        }
        db.add(scan)
        db.add(artifact)
    else:
        try:
            safe_git_url = await asyncio.to_thread(validate_public_git_url, str(request.git_url))
        except GitSecurityError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        scan.source_config = {"git_url": safe_git_url}
        db.add(scan)

    await db.commit()
    await db.refresh(scan)
    if artifact is not None:
        await db.refresh(artifact)
        return ScanCreateResponse(
            scan=ScanResponse.model_validate(scan),
            artifact=artifact,
            upload=_upload_contract(artifact),
        )

    await _dispatch_after_commit(db, scan)
    return ScanCreateResponse(scan=ScanResponse.model_validate(scan))


def _normalized_content_type(value: str) -> str:
    return value.split(";", maxsplit=1)[0].strip().lower()


async def _verify_storage_object(
    storage: SupabaseStorage,
    artifact: ScanArtifact,
    expected_sha256: str,
) -> str:
    try:
        info: StorageObjectInfo = await asyncio.to_thread(
            storage.get_object_info,
            artifact.bucket,
            artifact.object_path,
        )
    except StorageOperationError as exc:
        if exc.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Uploaded object was not found",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage verification is temporarily unavailable",
        ) from exc

    maximum_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if info.size > maximum_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded object exceeds the configured size limit",
        )
    if info.size != artifact.byte_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded object size does not match reserved metadata",
        )
    if _normalized_content_type(info.content_type) != _normalized_content_type(
        artifact.content_type
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded object content type does not match reserved metadata",
        )

    temporary = tempfile.NamedTemporaryFile(prefix="threatlens-upload-", delete=False)
    temporary_path = Path(temporary.name)
    temporary.close()
    try:
        try:
            written, digest = await asyncio.to_thread(
                storage.download_to_path_and_hash,
                artifact.bucket,
                artifact.object_path,
                str(temporary_path),
                maximum_bytes=maximum_bytes,
            )
        except StorageOperationError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Storage verification is temporarily unavailable",
            ) from exc
        except StorageSizeLimitError as exc:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Uploaded object exceeds the configured size limit",
            ) from exc
        if written != artifact.byte_size or digest != expected_sha256:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uploaded object checksum does not match",
            )
        return digest
    finally:
        temporary_path.unlink(missing_ok=True)


@router.post(
    "/{scan_id}/start",
    response_model=ScanResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_scan(
    scan_id: UUID,
    request: ScanStartRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    scan = await _load_scan(db, scan_id)
    await _authorize_scan(db, scan, user.id, WorkspaceRole.ANALYST)
    if scan.source_type is not SourceType.UPLOAD or scan.status is not ScanStatus.UPLOADING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scan is not awaiting an upload",
        )

    result = await db.execute(
        select(ScanArtifact).where(
            ScanArtifact.id == request.artifact_id,
            ScanArtifact.scan_id == scan.id,
        )
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    if artifact.status is not ArtifactStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Artifact has already been verified",
        )
    expected_path = scan_input_object_path(
        scan.workspace_id,
        scan.id,
        artifact.id,
        artifact.original_filename,
    )
    if (
        artifact.bucket != settings.SUPABASE_SCAN_BUCKET
        or artifact.object_path != expected_path
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Artifact storage metadata is invalid",
        )

    try:
        storage = get_scan_storage()
    except StorageConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service is not configured",
        ) from exc
    digest = await _verify_storage_object(storage, artifact, request.sha256)

    transition = await db.execute(
        update(Scan)
        .where(Scan.id == scan.id, Scan.status == ScanStatus.UPLOADING)
        .values(status=ScanStatus.QUEUED)
        .returning(Scan.id)
    )
    if transition.scalar_one_or_none() is None:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Scan has already been started",
        )
    artifact.status = ArtifactStatus.VERIFIED
    artifact.sha256 = digest
    scan.status = ScanStatus.QUEUED
    await db.commit()
    await _dispatch_after_commit(db, scan)
    await db.refresh(scan)
    return ScanResponse.model_validate(scan)


@router.get("", response_model=ScanListResponse)
async def list_scans(
    workspace_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    await require_workspace_role(db, workspace_id, user.id, WorkspaceRole.VIEWER)
    total_result = await db.execute(
        select(func.count()).select_from(Scan).where(Scan.workspace_id == workspace_id)
    )
    total = total_result.scalar_one()
    result = await db.execute(
        select(Scan)
        .where(Scan.workspace_id == workspace_id)
        .order_by(Scan.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    scans = result.scalars().all()
    return ScanListResponse(items=scans, total=total, limit=limit, offset=offset)


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Scan:
    scan = await _load_scan(db, scan_id)
    await _authorize_scan(db, scan, user.id, WorkspaceRole.VIEWER)
    return scan


@router.delete(
    "/{scan_id}",
    response_model=ScanDeleteResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def delete_scan(
    scan_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScanDeleteResponse:
    scan = await _load_scan(db, scan_id)
    await _authorize_scan(db, scan, user.id, WorkspaceRole.ADMIN)
    if scan.status is not ScanStatus.CANCELLED:
        previous_status = scan.status
        scan.status = ScanStatus.CANCELLED
        await db.commit()
        try:
            dispatch_cleanup(scan.id)
        except Exception as exc:
            scan.status = previous_status
            scan.error_code = "cleanup_queue_unavailable"
            scan.error_message = "Cleanup could not be scheduled"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cleanup queue is temporarily unavailable",
            ) from exc
    return ScanDeleteResponse(scan_id=scan.id)
