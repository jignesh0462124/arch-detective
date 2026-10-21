from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api import scans as scans_api
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.main import app
from app.models.finding import Finding, FindingSource, FindingState, Severity
from app.models.scan import Scan, ScanStatus, ScanType, SourceType
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser


class _Result:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one(self) -> object:
        return self.value

    def scalars(self) -> "_Result":
        return self

    def all(self) -> list[object]:
        assert isinstance(self.value, list)
        return self.value


class _Session:
    def __init__(self, results: list[object]) -> None:
        self.results = list(results)

    async def execute(self, _statement: object) -> _Result:
        return _Result(self.results.pop(0))


async def _allow_viewer(*_args: object, **_kwargs: object) -> WorkspaceRole:
    return WorkspaceRole.VIEWER


async def _async_value(value: object) -> object:
    return value


def _scan() -> Scan:
    return Scan(
        id=uuid4(),
        workspace_id=uuid4(),
        created_by=uuid4(),
        scan_type=ScanType.CODEBASE,
        source_type=SourceType.GIT,
        target_name="payments-api",
        source_config={},
        selected_frameworks=["soc2"],
        status=ScanStatus.COMPLETED,
        progress=100,
        finding_count=1,
        framework_scores={},
        created_at=datetime.now(timezone.utc),
    )


def _finding(scan_id: UUID) -> Finding:
    now = datetime.now(timezone.utc)
    return Finding(
        id=uuid4(),
        scan_id=scan_id,
        title="SQL injection",
        description="Unsafe query construction.",
        severity=Severity.CRITICAL,
        source=FindingSource.SEMGREP,
        cwe_id="CWE-89",
        fingerprint="a" * 64,
        state=FindingState.OPEN,
        created_at=now,
        updated_at=now,
    )


def test_findings_endpoint_requires_authentication() -> None:
    response = TestClient(app).get(f"/api/v1/scans/{uuid4()}/findings")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_findings_are_workspace_scoped_filtered_and_paginated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    scan = _scan()
    finding = _finding(scan.id)
    monkeypatch.setattr(
        scans_api,
        "_load_scan",
        lambda *_args: _async_value(scan),
    )
    monkeypatch.setattr(scans_api, "_authorize_scan", _allow_viewer)
    db = _Session([1, [finding]])

    response = await scans_api.list_scan_findings(
        scan_id=scan.id,
        severity=Severity.CRITICAL,
        framework="soc2",
        source=FindingSource.SEMGREP,
        limit=20,
        offset=0,
        user=AuthenticatedUser(id=uuid4()),
        db=db,  # type: ignore[arg-type]
    )

    assert response.total == 1
    assert response.items[0].id == finding.id
    assert response.items[0].severity is Severity.CRITICAL


def test_findings_endpoint_rejects_unknown_filter_before_access() -> None:
    async def db_override() -> object:
        yield object()

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=uuid4())
    app.dependency_overrides[get_db] = db_override
    try:
        response = TestClient(app).get(
            f"/api/v1/scans/{uuid4()}/findings",
            params={"framework": "unknown"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 422
