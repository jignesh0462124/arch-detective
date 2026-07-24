from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.models.scan import ScanStatus, ScanType, SourceType
from app.models.scan_artifact import ArtifactKind, ArtifactStatus
from app.ingestion.validation import normalize_sha256, validate_upload_contract

SUPPORTED_FRAMEWORK_IDS = frozenset({"gdpr", "soc2", "iso27001", "pci_dss", "nist_csf"})


class ScanCreate(BaseModel):
    workspace_id: UUID
    scan_type: ScanType
    source_type: SourceType
    target_name: str = Field(min_length=1, max_length=255)
    frameworks: list[str] = Field(min_length=1, max_length=5)
    filename: str | None = Field(default=None, min_length=1, max_length=255)
    content_type: str | None = Field(default=None, min_length=1, max_length=255)
    byte_size: int | None = Field(default=None, ge=1)
    artifact_kind: ArtifactKind | None = None
    git_url: HttpUrl | None = None

    @field_validator("target_name")
    @classmethod
    def normalize_target_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("target_name must not be blank")
        return normalized

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, value: SourceType) -> SourceType:
        if value not in {SourceType.UPLOAD, SourceType.GIT}:
            raise ValueError("source_type must be upload or git")
        return value

    @field_validator("frameworks")
    @classmethod
    def validate_frameworks(cls, value: list[str]) -> list[str]:
        normalized = [framework.strip().lower() for framework in value]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Framework IDs must be unique")
        unknown = sorted(set(normalized) - SUPPORTED_FRAMEWORK_IDS)
        if unknown:
            raise ValueError(f"Unsupported framework IDs: {', '.join(unknown)}")
        return normalized

    @model_validator(mode="after")
    def validate_source_contract(self) -> Self:
        upload_fields = {
            "filename": self.filename,
            "content_type": self.content_type,
            "byte_size": self.byte_size,
            "artifact_kind": self.artifact_kind,
        }
        if self.source_type is SourceType.UPLOAD:
            missing = [name for name, value in upload_fields.items() if value is None]
            if missing:
                raise ValueError(f"Upload source is missing: {', '.join(missing)}")
            if self.git_url is not None:
                raise ValueError("Upload source must not include git_url")
            validate_upload_contract(
                self.scan_type,
                self.artifact_kind,  # type: ignore[arg-type]
                self.filename,  # type: ignore[arg-type]
                self.content_type,  # type: ignore[arg-type]
            )
        else:
            if self.git_url is None:
                raise ValueError("Git source requires git_url")
            if any(value is not None for value in upload_fields.values()):
                raise ValueError("Git source must not include upload metadata")
            if self.git_url.scheme != "https":
                raise ValueError("Git URL must use HTTPS")
            if self.git_url.username or self.git_url.password:
                raise ValueError("Git URL must not contain credentials")
            if self.scan_type not in {ScanType.CODEBASE, ScanType.FULL}:
                raise ValueError("Git sources support codebase or full scans")
        return self


class ScanStartRequest(BaseModel):
    artifact_id: UUID
    sha256: str

    @field_validator("sha256")
    @classmethod
    def validate_sha256(cls, value: str) -> str:
        return normalize_sha256(value)


class ScanUploadContract(BaseModel):
    protocol: str = "tus"
    endpoint: str
    bucket: str
    object_path: str
    max_file_size: int = Field(gt=0)


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


class ScanCreateResponse(BaseModel):
    scan: ScanResponse
    artifact: ScanArtifactResponse | None = None
    upload: ScanUploadContract | None = None


class ScanListResponse(BaseModel):
    items: list[ScanResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class ScanDeleteResponse(BaseModel):
    scan_id: UUID
    status: str = "deletion_queued"
