"""Workspace management API — CRUD, member management, and invite flow."""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import ROLE_RANK, get_workspace_role, require_workspace_role
from app.database import get_db
from app.models.scan import Scan
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.models.workspace_invite import WorkspaceInvite
from app.schemas.auth import AuthenticatedUser

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9\-]{1,138}[a-z0-9]$")

# ── Pydantic schemas ──────────────────────────────────────────────────────────


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=3, max_length=140)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    owner_user_id: UUID
    created_at: datetime
    role: WorkspaceRole
    member_count: int
    scan_count: int


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    role: WorkspaceRole
    created_at: datetime


class MemberRoleUpdate(BaseModel):
    role: WorkspaceRole


class InviteRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    role: WorkspaceRole


class InviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    invited_email: str
    role: WorkspaceRole
    expires_at: datetime
    created_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────


def _validate_slug(slug: str) -> None:
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="slug must be lowercase alphanumeric with hyphens (a-z0-9-), 3-140 chars",
        )


async def _count_members(db: AsyncSession, workspace_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).where(WorkspaceMember.workspace_id == workspace_id)
    )
    return result.scalar_one()


async def _count_scans(db: AsyncSession, workspace_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).where(Scan.workspace_id == workspace_id)
    )
    return result.scalar_one()


async def _build_workspace_response(
    db: AsyncSession,
    workspace: Workspace,
    role: WorkspaceRole,
) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        owner_user_id=workspace.owner_user_id,
        created_at=workspace.created_at,
        role=role,
        member_count=await _count_members(db, workspace.id),
        scan_count=await _count_scans(db, workspace.id),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    _validate_slug(body.slug)

    existing = await db.execute(select(Workspace).where(Workspace.slug == body.slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A workspace with that slug already exists",
        )

    workspace = Workspace(
        name=body.name,
        slug=body.slug,
        owner_user_id=current_user.id,
    )
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role=WorkspaceRole.OWNER,
    )
    db.add(member)
    await db.commit()
    await db.refresh(workspace)

    return await _build_workspace_response(db, workspace, WorkspaceRole.OWNER)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceResponse]:
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.created_at)
    )
    rows = result.all()
    out = []
    for workspace, role in rows:
        out.append(await _build_workspace_response(db, workspace, role))
    return out


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    role = await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.VIEWER)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return await _build_workspace_response(db, workspace, role)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    body: WorkspaceUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    role = await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.OWNER)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    if body.name is not None:
        workspace.name = body.name

    await db.commit()
    await db.refresh(workspace)
    return await _build_workspace_response(db, workspace, role)


# ── Members ───────────────────────────────────────────────────────────────────


@router.get("/{workspace_id}/members", response_model=list[MemberResponse])
async def list_members(
    workspace_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MemberResponse]:
    await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.ADMIN)
    result = await db.execute(
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at)
    )
    return list(result.scalars().all())


@router.patch("/{workspace_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    body: MemberRoleUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemberResponse:
    await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.OWNER)

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    member.role = body.role
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(db, workspace_id, current_user.id, WorkspaceRole.OWNER)

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself from the workspace",
        )

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    await db.delete(member)
    await db.commit()


# ── Invites ───────────────────────────────────────────────────────────────────


@router.post("/{workspace_id}/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    workspace_id: UUID,
    body: InviteRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InviteResponse:
    role = await get_workspace_role(db, workspace_id, current_user.id)
    if role is None or ROLE_RANK[role] < ROLE_RANK[WorkspaceRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or owner role required to invite members",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        invited_email=body.email,
        token=secrets.token_hex(32),
        role=body.role,
        invited_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite
