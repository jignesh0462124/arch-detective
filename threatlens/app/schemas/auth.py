from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.workspace import WorkspaceRole


class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr | None = None
    session_id: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=2048)


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime


class WorkspaceMembershipResponse(BaseModel):
    workspace_id: UUID
    workspace_name: str
    workspace_slug: str
    role: WorkspaceRole


class CurrentUserResponse(BaseModel):
    user: AuthenticatedUser
    profile: ProfileResponse | None
    memberships: list[WorkspaceMembershipResponse]


class BootstrapResponse(BaseModel):
    profile: ProfileResponse
    memberships: list[WorkspaceMembershipResponse]
