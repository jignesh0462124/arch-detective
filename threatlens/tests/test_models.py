from app.database import Base
from app.models import (
    AuditEvent,
    ComplianceViolation,
    Finding,
    Profile,
    Report,
    Scan,
    ScanArtifact,
    Workspace,
    WorkspaceMember,
)


def test_supabase_foundation_tables_are_registered() -> None:
    expected = {
        Profile.__tablename__,
        Workspace.__tablename__,
        WorkspaceMember.__tablename__,
        Scan.__tablename__,
        ScanArtifact.__tablename__,
        Finding.__tablename__,
        ComplianceViolation.__tablename__,
        Report.__tablename__,
        AuditEvent.__tablename__,
    }

    assert expected <= set(Base.metadata.tables)
    assert "auth.users" in Base.metadata.tables
    assert "users" not in Base.metadata.tables


def test_report_does_not_persist_signed_url_credentials() -> None:
    assert "signed_url" not in Report.__table__.columns
    assert "pdf_url" not in Report.__table__.columns
    assert {"bucket", "object_path", "sha256"} <= set(Report.__table__.columns.keys())
