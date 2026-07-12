from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: UUID
    pdf_url: str
    signed_url: str | None
    generated_at: datetime
    expires_at: datetime | None
