import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.profile import Profile
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.auth import (
    AuthenticatedUser,
    BootstrapResponse,
    CurrentUserResponse,
    ProfileResponse,
    ProfileUpdate,
    WorkspaceMembershipResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _membership_response(member: WorkspaceMember) -> WorkspaceMembershipResponse:
    return WorkspaceMembershipResponse(
        workspace_id=member.workspace_id,
        workspace_name=member.workspace.name,
        workspace_slug=member.workspace.slug,
        role=member.role,
    )


async def _load_memberships(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[WorkspaceMembershipResponse]:
    result = await db.execute(
        select(WorkspaceMember)
        .options(joinedload(WorkspaceMember.workspace))
        .where(WorkspaceMember.user_id == user_id)
        .order_by(WorkspaceMember.created_at),
    )
    return [_membership_response(member) for member in result.scalars().all()]


def _workspace_slug(user: AuthenticatedUser) -> str:
    source = (str(user.email).split("@", maxsplit=1)[0] if user.email else "workspace").lower()
    safe = re.sub(r"[^a-z0-9]+", "-", source).strip("-") or "workspace"
    return f"{safe}-{user.id.hex[:8]}"


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CurrentUserResponse:
    profile = await db.get(Profile, user.id)
    memberships = await _load_memberships(db, user.id)
    return CurrentUserResponse(user=user, profile=profile, memberships=memberships)


@router.post("/bootstrap", response_model=BootstrapResponse)
async def bootstrap_user(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BootstrapResponse:
    display_name = str(user.email).split("@", maxsplit=1)[0] if user.email else None
    await db.execute(
        insert(Profile)
        .values(id=user.id, display_name=display_name)
        .on_conflict_do_nothing(),
    )

    membership_result = await db.execute(
        select(WorkspaceMember).where(WorkspaceMember.user_id == user.id).limit(1),
    )
    if membership_result.scalar_one_or_none() is None:
        workspace_id = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"threatlens:personal-workspace:{user.id}",
        )
        await db.execute(
            insert(Workspace)
            .values(
                id=workspace_id,
                name=f"{display_name or 'Personal'} Workspace",
                slug=_workspace_slug(user),
                owner_user_id=user.id,
            )
            .on_conflict_do_nothing(),
        )
        await db.execute(
            insert(WorkspaceMember)
            .values(
                workspace_id=workspace_id,
                user_id=user.id,
                role=WorkspaceRole.OWNER,
            )
            .on_conflict_do_nothing(),
        )

    await db.commit()
    profile = await db.get(Profile, user.id)
    if profile is None:
        raise RuntimeError("Profile bootstrap did not persist")
    memberships = await _load_memberships(db, user.id)
    return BootstrapResponse(profile=profile, memberships=memberships)


@router.patch("/profile", response_model=ProfileResponse)
async def update_profile(
    update: ProfileUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    profile = await db.get(Profile, user.id)
    if profile is None:
        profile = Profile(id=user.id)
        db.add(profile)

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return ProfileResponse.model_validate(profile)
