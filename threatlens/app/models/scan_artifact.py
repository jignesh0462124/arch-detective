import uuid
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ArtifactKind(StrEnum):
    SOURCE_ZIP = "source_zip"
    ARCHITECTURE_YAML = "architecture_yaml"
    LOG_BUNDLE = "log_bundle"
    OTHER = "other"


class ArtifactStatus(StrEnum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    PROCESSED = "processed"
    DELETED = "deleted"


class ScanArtifact(Base):
    __tablename__ = "scan_artifacts"
    __table_args__ = (
        UniqueConstraint("bucket", "object_path", name="uq_scan_artifacts_object"),
        CheckConstraint("byte_size >= 0", name="ck_scan_artifacts_byte_size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scans.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    kind: Mapped[ArtifactKind] = mapped_column(
        Enum(
            ArtifactKind,
            name="artifact_kind",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    object_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[ArtifactStatus] = mapped_column(
        Enum(
            ArtifactStatus,
            name="artifact_status",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=ArtifactStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    scan = relationship("Scan", back_populates="artifacts")
