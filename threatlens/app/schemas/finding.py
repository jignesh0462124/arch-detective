from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.finding import FindingSource, Severity


class ComplianceViolationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    finding_id: UUID
    framework: str
    control_id: str
    control_title: str
    violation_description: str
    evidence: str
    rag_chunk_ids: list[str]


class FindingCreate(BaseModel):
    scan_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    severity: Severity
    source: FindingSource
    cvss_score: float | None = Field(default=None, ge=0, le=10)
    cvss_vector: str | None = None
    cwe_id: str | None = None
    cve_id: str | None = None
    file_path: str | None = None
    line_number: int | None = Field(default=None, ge=1)
    code_snippet: str | None = None
    remediation: str | None = None


class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scan_id: UUID
    title: str
    description: str
    severity: Severity
    cvss_score: float | None
    cvss_vector: str | None
    cwe_id: str | None
    cve_id: str | None
    file_path: str | None
    line_number: int | None
    code_snippet: str | None
    source: FindingSource
    remediation: str | None
    created_at: datetime


class FindingDetailResponse(FindingResponse):
    violations: list[ComplianceViolationResponse] = Field(default_factory=list)
    remediation_steps: list[str] = Field(default_factory=list)
    remediation_priority: str | None = None
