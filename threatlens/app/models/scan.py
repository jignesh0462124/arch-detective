import uuid
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ScanStatus(StrEnum):
    PENDING = "pending"
    UPLOADING = "uploading"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanType(StrEnum):
    CODEBASE = "codebase"
    ARCHITECTURE = "architecture"
    LOGS = "logs"
    FULL = "full"


class SourceType(StrEnum):
    UPLOAD = "upload"
    GIT = "git"
    ARCHITECTURE = "architecture"
    LOGS = "logs"
    FULL = "full"


class Scan(Base):
    __tablename__ = "scans"
    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="ck_scans_progress"),
        CheckConstraint("finding_count >= 0", name="ck_scans_finding_count"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    scan_type: Mapped[ScanType] = mapped_column(
        Enum(
            ScanType,
            name="scan_type",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    source_type: Mapped[SourceType] = mapped_column(
        Enum(
            SourceType,
            name="source_type",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    target_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_config: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    selected_frameworks: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)),
        default=list,
        nullable=False,
    )
    status: Mapped[ScanStatus] = mapped_column(
        Enum(
            ScanStatus,
            name="scan_status",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=ScanStatus.PENDING,
        index=True,
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    finding_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    framework_scores: Mapped[dict[str, int]] = mapped_column(JSONB, default=dict, nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255))
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workspace = relationship("Workspace", back_populates="scans")
    artifacts = relationship(
        "ScanArtifact",
        back_populates="scan",
        cascade="all, delete-orphan",
    )
    findings = relationship("Finding", back_populates="scan", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="scan", cascade="all, delete-orphan")
