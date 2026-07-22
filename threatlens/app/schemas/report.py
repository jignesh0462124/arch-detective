from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.report import ReportStatus


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: UUID
    status: ReportStatus
    bucket: str
    object_path: str
    sha256: str | None
    byte_size: int | None
    version: int
    generated_at: datetime | None
    error_message: str | None


class ReportDownloadResponse(BaseModel):
    url: str
    expires_in: int
