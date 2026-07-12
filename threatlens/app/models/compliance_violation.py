import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ComplianceViolation(Base):
    __tablename__ = "compliance_violations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    finding_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("findings.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    framework: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    control_id: Mapped[str] = mapped_column(String(64), nullable=False)
    control_title: Mapped[str] = mapped_column(String(255), nullable=False)
    violation_description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rag_chunk_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    finding = relationship("Finding", back_populates="violations")
