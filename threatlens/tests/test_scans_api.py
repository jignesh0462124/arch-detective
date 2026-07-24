from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import scans as scans_api
from app.config import settings
from app.main import app
from app.models.scan import Scan, ScanStatus, ScanType, SourceType
from app.models.scan_artifact import ArtifactKind, ArtifactStatus, ScanArtifact
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser
from app.schemas.scan import ScanCreate, ScanStartRequest
from app.storage.client import StorageObjectInfo
from app.storage.paths import scan_input_object_path


class _Result:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalar_one(self) -> object:
        return self.value

    def scalars(self) -> "_Result":
        return self

    def all(self) -> list[object]:
        assert isinstance(self.value, list)
        return self.value


class _FakeSession:
    def __init__(self, results: list[object] | None = None) -> None:
        self.added: list[object] = []
        self.results = list(results or [])
        self.commits = 0
        self.rollbacks = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def execute(self, _statement: object) -> _Result:
        return _Result(self.results.pop(0))

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def refresh(self, value: object) -> None:
        now = datetime.now(timezone.utc)
        if isinstance(value, Scan):
            value.progress = value.progress or 0
            value.finding_count = value.finding_count or 0
            value.framework_scores = value.framework_scores or {}
            value.created_at = value.created_at or now
        if isinstance(value, ScanArtifact):
            value.created_at = value.created_at or now


class _VerifiedStorage:
    def __init__(self, content: bytes, content_type: str = "application/zip") -> None:
        self.content = content
        self.content_type = content_type

    def get_object_info(self, _bucket: str, _path: str) -> StorageObjectInfo:
        return StorageObjectInfo(size=len(self.content), content_type=self.content_type)

    def download_to_path_and_hash(
        self,
        _bucket: str,
        _path: str,
        destination: str,
        *,
        maximum_bytes: int,
    ) -> tuple[int, str]:
        assert len(self.content) <= maximum_bytes
        Path(destination).write_bytes(self.content)
        return len(self.content), hashlib.sha256(self.content).hexdigest()


async def _allow_role(*_args: object, **_kwargs: object) -> WorkspaceRole:
    return WorkspaceRole.ANALYST


def _upload_request(workspace_id: UUID, byte_size: int) -> ScanCreate:
    return ScanCreate(
        workspace_id=workspace_id,
        scan_type=ScanType.CODEBASE,
        source_type=SourceType.UPLOAD,
        target_name="payments-api",
        frameworks=["soc2", "iso27001"],
        filename="source.zip",
        content_type="application/zip",
        byte_size=byte_size,
        artifact_kind=ArtifactKind.SOURCE_ZIP,
    )


def _scan_and_artifact(content: bytes) -> tuple[Scan, ScanArtifact]:
    scan_id = uuid4()
    workspace_id = uuid4()
    artifact_id = uuid4()
    artifact = ScanArtifact(
        id=artifact_id,
        scan_id=scan_id,
        kind=ArtifactKind.SOURCE_ZIP,
        bucket=settings.SUPABASE_SCAN_BUCKET,
        object_path=scan_input_object_path(
            workspace_id,
            scan_id,
            artifact_id,
            "source.zip",
        ),
        original_filename="source.zip",
        content_type="application/zip",
        byte_size=len(content),
        status=ArtifactStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )
    scan = Scan(
        id=scan_id,
        workspace_id=workspace_id,
        created_by=uuid4(),
        scan_type=ScanType.CODEBASE,
        source_type=SourceType.UPLOAD,
        target_name="payments-api",
        source_config={"artifact_id": str(artifact_id)},
        selected_frameworks=["soc2"],
        status=ScanStatus.UPLOADING,
        progress=0,
        finding_count=0,
        framework_scores={},
        created_at=datetime.now(timezone.utc),
    )
    return scan, artifact


def test_scan_creation_requires_authentication() -> None:
    response = TestClient(app).post(
        "/api/v1/scans",
        json={
            "workspace_id": str(uuid4()),
            "scan_type": "codebase",
            "source_type": "upload",
            "target_name": "payments-api",
            "frameworks": ["soc2"],
            "filename": "source.zip",
            "content_type": "application/zip",
            "byte_size": 128,
            "artifact_kind": "source_zip",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_creation_reserves_canonical_private_object_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scans_api, "require_workspace_role", _allow_role)
    workspace_id = uuid4()
    user = AuthenticatedUser(id=uuid4(), email="analyst@example.com")
    db = _FakeSession()

    response = await scans_api.create_scan(
        _upload_request(workspace_id, 128),
        user,
        db,  # type: ignore[arg-type]
    )

    assert response.scan.status is ScanStatus.UPLOADING
    assert response.artifact is not None
    assert response.upload is not None
    assert response.artifact.bucket == settings.SUPABASE_SCAN_BUCKET
    assert response.artifact.object_path == scan_input_object_path(
        workspace_id,
        response.scan.id,
        response.artifact.id,
        "source.zip",
    )
    assert response.upload.object_path == response.artifact.object_path
    assert response.upload.protocol == "tus"


@pytest.mark.asyncio
async def test_upload_creation_rejects_oversized_reservation_with_413(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scans_api, "require_workspace_role", _allow_role)
    workspace_id = uuid4()
    db = _FakeSession()
    request = _upload_request(
        workspace_id,
        settings.MAX_FILE_SIZE_MB * 1024 * 1024 + 1,
    )

    with pytest.raises(HTTPException) as error:
        await scans_api.create_scan(
            request,
            AuthenticatedUser(id=uuid4()),
            db,  # type: ignore[arg-type]
        )

    assert error.value.status_code == 413
    assert db.added == []


@pytest.mark.asyncio
async def test_git_creation_sanitizes_url_and_dispatches_after_commit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scans_api, "require_workspace_role", _allow_role)
    monkeypatch.setattr(
        scans_api,
        "validate_public_git_url",
        lambda _url: "https://github.com/example/repo.git",
    )
    dispatched: list[UUID] = []
    monkeypatch.setattr(
        scans_api,
        "dispatch_ingestion",
        lambda scan_id: dispatched.append(scan_id) or "task-1",
    )
    db = _FakeSession()
    request = ScanCreate(
        workspace_id=uuid4(),
        scan_type=ScanType.CODEBASE,
        source_type=SourceType.GIT,
        target_name="repo",
        frameworks=["soc2"],
        git_url="https://github.com/example/repo.git",
    )

    response = await scans_api.create_scan(
        request,
        AuthenticatedUser(id=uuid4()),
        db,  # type: ignore[arg-type]
    )

    scan = next(item for item in db.added if isinstance(item, Scan))
    assert scan.source_config == {"git_url": "https://github.com/example/repo.git"}
    assert response.scan.status is ScanStatus.QUEUED
    assert dispatched == [response.scan.id]
    assert db.commits == 2


@pytest.mark.asyncio
async def test_upload_start_verifies_hash_and_enqueues_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = b"trusted archive"
    scan, artifact = _scan_and_artifact(content)
    db = _FakeSession(results=[artifact, scan.id])
    monkeypatch.setattr(scans_api, "_load_scan", lambda *_args: _async_value(scan))
    monkeypatch.setattr(scans_api, "_authorize_scan", _allow_role)
    monkeypatch.setattr(scans_api, "get_scan_storage", lambda: _VerifiedStorage(content))
    dispatched: list[UUID] = []
    monkeypatch.setattr(
        scans_api,
        "dispatch_ingestion",
        lambda scan_id: dispatched.append(scan_id) or "task-2",
    )

    response = await scans_api.start_scan(
        scan.id,
        ScanStartRequest(
            artifact_id=artifact.id,
            sha256=hashlib.sha256(content).hexdigest(),
        ),
        AuthenticatedUser(id=uuid4()),
        db,  # type: ignore[arg-type]
    )

    assert response.status is ScanStatus.QUEUED
    assert artifact.status is ArtifactStatus.VERIFIED
    assert artifact.sha256 == hashlib.sha256(content).hexdigest()
    assert dispatched == [scan.id]


async def _async_value(value: Any) -> Any:
    return value


@pytest.mark.asyncio
async def test_repeated_start_loses_conditional_transition_and_does_not_enqueue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content = b"trusted archive"
    scan, artifact = _scan_and_artifact(content)
    db = _FakeSession(results=[artifact, None])
    monkeypatch.setattr(scans_api, "_load_scan", lambda *_args: _async_value(scan))
    monkeypatch.setattr(scans_api, "_authorize_scan", _allow_role)
    monkeypatch.setattr(scans_api, "get_scan_storage", lambda: _VerifiedStorage(content))
    dispatched: list[UUID] = []
    monkeypatch.setattr(
        scans_api,
        "dispatch_ingestion",
        lambda scan_id: dispatched.append(scan_id) or "unexpected",
    )

    with pytest.raises(HTTPException) as error:
        await scans_api.start_scan(
            scan.id,
            ScanStartRequest(
                artifact_id=artifact.id,
                sha256=hashlib.sha256(content).hexdigest(),
            ),
            AuthenticatedUser(id=uuid4()),
            db,  # type: ignore[arg-type]
        )

    assert error.value.status_code == 409
    assert dispatched == []
    assert db.rollbacks == 1


@pytest.mark.asyncio
async def test_storage_metadata_and_checksum_mismatches_are_rejected() -> None:
    content = b"trusted archive"
    _, artifact = _scan_and_artifact(content)

    with pytest.raises(HTTPException) as wrong_mime:
        await scans_api._verify_storage_object(
            _VerifiedStorage(content, "text/plain"),  # type: ignore[arg-type]
            artifact,
            hashlib.sha256(content).hexdigest(),
        )
    assert wrong_mime.value.status_code == 422

    with pytest.raises(HTTPException) as wrong_hash:
        await scans_api._verify_storage_object(
            _VerifiedStorage(content),  # type: ignore[arg-type]
            artifact,
            "0" * 64,
        )
    assert wrong_hash.value.status_code == 422


@pytest.mark.asyncio
async def test_scan_authorization_hides_cross_workspace_resources() -> None:
    scan, _ = _scan_and_artifact(b"content")
    no_membership = _FakeSession(results=[None])
    with pytest.raises(HTTPException) as hidden:
        await scans_api._authorize_scan(
            no_membership,  # type: ignore[arg-type]
            scan,
            uuid4(),
            WorkspaceRole.VIEWER,
        )
    assert hidden.value.status_code == 404

    viewer = _FakeSession(results=[WorkspaceRole.VIEWER])
    with pytest.raises(HTTPException) as forbidden:
        await scans_api._authorize_scan(
            viewer,  # type: ignore[arg-type]
            scan,
            uuid4(),
            WorkspaceRole.ADMIN,
        )
    assert forbidden.value.status_code == 403


@pytest.mark.asyncio
async def test_scan_list_is_workspace_scoped_and_paginated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scans_api, "require_workspace_role", _allow_role)
    scan, _ = _scan_and_artifact(b"content")
    db = _FakeSession(results=[1, [scan]])

    response = await scans_api.list_scans(
        workspace_id=scan.workspace_id,
        limit=20,
        offset=0,
        user=AuthenticatedUser(id=uuid4()),
        db=db,  # type: ignore[arg-type]
    )

    assert response.total == 1
    assert response.items[0].id == scan.id
    assert response.limit == 20
    assert response.offset == 0


@pytest.mark.asyncio
async def test_delete_marks_cancelled_and_dispatches_cleanup_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scan, _ = _scan_and_artifact(b"content")
    monkeypatch.setattr(scans_api, "_load_scan", lambda *_args: _async_value(scan))
    monkeypatch.setattr(scans_api, "_authorize_scan", _allow_role)
    dispatched: list[UUID] = []
    monkeypatch.setattr(
        scans_api,
        "dispatch_cleanup",
        lambda scan_id: dispatched.append(scan_id) or "cleanup-1",
    )
    db = _FakeSession()

    first = await scans_api.delete_scan(
        scan.id,
        AuthenticatedUser(id=uuid4()),
        db,  # type: ignore[arg-type]
    )
    second = await scans_api.delete_scan(
        scan.id,
        AuthenticatedUser(id=uuid4()),
        db,  # type: ignore[arg-type]
    )

    assert first.status == "deletion_queued"
    assert second.status == "deletion_queued"
    assert scan.status is ScanStatus.CANCELLED
    assert dispatched == [scan.id]


@pytest.mark.asyncio
async def test_delete_restores_state_when_cleanup_queue_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scan, _ = _scan_and_artifact(b"content")
    monkeypatch.setattr(scans_api, "_load_scan", lambda *_args: _async_value(scan))
    monkeypatch.setattr(scans_api, "_authorize_scan", _allow_role)
    monkeypatch.setattr(
        scans_api,
        "dispatch_cleanup",
        lambda _scan_id: (_ for _ in ()).throw(RuntimeError("redis down")),
    )
    db = _FakeSession()

    with pytest.raises(HTTPException) as error:
        await scans_api.delete_scan(
            scan.id,
            AuthenticatedUser(id=uuid4()),
            db,  # type: ignore[arg-type]
        )

    assert error.value.status_code == 503
    assert scan.status is ScanStatus.UPLOADING
