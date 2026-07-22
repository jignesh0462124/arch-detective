from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.scan import ScanStatus, ScanType, SourceType
from app.models.scan_artifact import ArtifactKind, ArtifactStatus


class ScanCreate(BaseModel):
    workspace_id: UUID
    scan_type: ScanType
    source_type: SourceType
    target_name: str = Field(min_length=1, max_length=255)
    frameworks: list[str] = Field(default_factory=list, max_length=10)
    git_url: HttpUrl | None = None


class ScanStatusResponse(BaseModel):
    scan_id: UUID
    status: ScanStatus
    progress: int = Field(ge=0, le=100)
    finding_count: int = Field(ge=0)
    current_phase: str = "pending"
    error_code: str | None = None
    error_message: str | None = None


class ScanArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: UUID
    kind: ArtifactKind
    bucket: str
    object_path: str
    original_filename: str
    content_type: str
    byte_size: int
    sha256: str | None
    status: ArtifactStatus
    created_at: datetime


class ScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    created_by: UUID
    scan_type: ScanType
    source_type: SourceType
    target_name: str
    selected_frameworks: list[str]
    status: ScanStatus
    progress: int
    finding_count: int
    framework_scores: dict[str, int]
    error_code: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
