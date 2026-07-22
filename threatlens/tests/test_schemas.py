from uuid import uuid4

from app.models.scan import ScanType, SourceType
from app.schemas.scan import ScanCreate


def test_scan_create_accepts_workspace_scoped_git_source() -> None:
    workspace_id = uuid4()
    scan = ScanCreate(
        workspace_id=workspace_id,
        scan_type=ScanType.CODEBASE,
        source_type=SourceType.GIT,
        target_name="payments-api",
        frameworks=["soc2", "iso27001"],
        git_url="https://github.com/example/payments-api.git",
    )

    assert scan.workspace_id == workspace_id
    assert str(scan.git_url) == "https://github.com/example/payments-api.git"
    assert scan.frameworks == ["soc2", "iso27001"]
