from app.database import Base
from app.models import ComplianceViolation, Finding, Report, Scan, User


def test_part_one_tables_are_registered() -> None:
    assert {
        User.__tablename__,
        Scan.__tablename__,
        Finding.__tablename__,
        ComplianceViolation.__tablename__,
        Report.__tablename__,
    } <= set(Base.metadata.tables)
