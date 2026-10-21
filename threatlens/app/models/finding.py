import uuid
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class FindingSource(StrEnum):
    STATIC_RULE = "static-rule"
    SEMGREP = "semgrep"
    BANDIT = "bandit"
    TRUFFLEHOG = "trufflehog"
    PIP_AUDIT = "pip-audit"
    NPM_AUDIT = "npm-audit"
    LOG_ANOMALY = "log-anomaly"
    LLM_REVIEW = "llm-review"
    ARCHITECTURE = "architecture"


class FindingState(StrEnum):
    OPEN = "open"
    ACCEPTED_RISK = "accepted_risk"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("scan_id", "fingerprint", name="uq_findings_scan_fingerprint"),)

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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[Severity] = mapped_column(
        Enum(
            Severity,
            name="severity",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        index=True,
        nullable=False,
    )
    cvss_score: Mapped[float | None] = mapped_column(Float)
    cvss_vector: Mapped[str | None] = mapped_column(String(255))
    cwe_id: Mapped[str | None] = mapped_column(String(32))
    cve_id: Mapped[str | None] = mapped_column(String(32))
    file_path: Mapped[str | None] = mapped_column(String(1024))
    line_number: Mapped[int | None] = mapped_column(Integer)
    code_snippet: Mapped[str | None] = mapped_column(Text)
    source: Mapped[FindingSource] = mapped_column(
        Enum(
            FindingSource,
            name="finding_source",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        index=True,
        nullable=False,
    )
    remediation: Mapped[str | None] = mapped_column(Text)
    fingerprint: Mapped[str | None] = mapped_column(String(64))
    state: Mapped[FindingState] = mapped_column(
        Enum(
            FindingState,
            name="finding_state",
            native_enum=False,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=FindingState.OPEN,
        index=True,
        nullable=False,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    scan = relationship("Scan", back_populates="findings")
    violations = relationship(
        "ComplianceViolation",
        back_populates="finding",
        cascade="all, delete-orphan",
    )
