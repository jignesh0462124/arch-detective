from collections.abc import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import WorkspaceMember, WorkspaceRole

ROLE_RANK = {
    WorkspaceRole.VIEWER: 0,
    WorkspaceRole.ANALYST: 1,
    WorkspaceRole.ADMIN: 2,
    WorkspaceRole.OWNER: 3,
}


async def get_workspace_role(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
) -> WorkspaceRole | None:
    result = await db.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        ),
    )
    return result.scalar_one_or_none()


async def require_workspace_role(
    db: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    minimum_role: WorkspaceRole = WorkspaceRole.VIEWER,
) -> WorkspaceRole:
    role = await get_workspace_role(db, workspace_id, user_id)
    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient workspace permissions",
        )
    return role


def highest_role(roles: Iterable[WorkspaceRole]) -> WorkspaceRole | None:
    return max(roles, key=ROLE_RANK.__getitem__, default=None)
