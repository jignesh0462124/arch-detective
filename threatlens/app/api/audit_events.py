"""Audit event log API — paginated workspace-scoped security events."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import require_workspace_role
from app.database import get_db
from app.models.audit_event import AuditEvent
from app.models.workspace import WorkspaceRole
from app.schemas.auth import AuthenticatedUser

router = APIRouter(prefix="/audit-events", tags=["audit"])


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    actor_user_id: UUID | None
    event_type: str
    resource_type: str | None
    resource_id: UUID | None
    event_metadata: dict
    created_at: datetime


class AuditEventListResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int
    limit: int
    offset: int


@router.get("", response_model=AuditEventListResponse)
async def list_audit_events(
    workspace_id: UUID = Query(..., description="Workspace to scope events to"),
    event_type: str | None = Query(default=None),
    scan_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditEventListResponse:
    await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.ADMIN)

    query = select(AuditEvent).where(AuditEvent.workspace_id == workspace_id)

    if event_type:
        query = query.where(AuditEvent.event_type == event_type)

    if scan_id:
        query = query.where(AuditEvent.resource_id == scan_id)

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    result = await db.execute(
        query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit).offset(offset)
    )
    events = list(result.scalars().all())

    return AuditEventListResponse(items=events, total=total, limit=limit, offset=offset)
