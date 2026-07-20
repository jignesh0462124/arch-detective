from app.models.scan import ScanType
from app.schemas.scan import ScanCreate


def test_scan_create_accepts_optional_git_url() -> None:
    scan = ScanCreate(
        scan_type=ScanType.CODEBASE,
        target_name="payments-api",
        frameworks=["soc2", "iso27001"],
        git_url="https://github.com/example/payments-api.git",
    )

    assert str(scan.git_url) == "https://github.com/example/payments-api.git"
    assert scan.frameworks == ["soc2", "iso27001"]
