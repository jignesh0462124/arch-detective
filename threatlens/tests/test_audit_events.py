from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api import audit_events
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser


@pytest.mark.asyncio
async def test_audit_events_endpoint_preserves_owner_admin_boundary(monkeypatch):
    async def gate(db, workspace_id, user_id, minimum_role):
        assert minimum_role == WorkspaceRole.ADMIN
        raise HTTPException(403, "Insufficient workspace permissions")

    monkeypatch.setattr(audit_events, "require_workspace_role", gate)
    with pytest.raises(HTTPException) as denied:
        await audit_events.list_audit_events(
            workspace_id=uuid4(), event_type=None, scan_id=None, limit=50, offset=0,
            current_user=AuthenticatedUser(id=uuid4(), email=None, session_id=None), db=None,
        )
    assert denied.value.status_code == 403
