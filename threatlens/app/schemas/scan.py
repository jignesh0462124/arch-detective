from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.scan import ScanStatus, ScanType


class ScanCreate(BaseModel):
    scan_type: ScanType
    target_name: str = Field(min_length=1, max_length=255)
    frameworks: list[str] = Field(default_factory=list)
    git_url: HttpUrl | None = None


class ScanStatusResponse(BaseModel):
    scan_id: UUID
    status: ScanStatus
    progress: int
    finding_count: int
    current_phase: str = "pending"


class ScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    scan_type: ScanType
    target_name: str
    status: ScanStatus
    progress: int
    finding_count: int
    framework_scores: dict[str, int]
    created_at: datetime
    completed_at: datetime | None
