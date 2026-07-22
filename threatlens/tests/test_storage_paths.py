from uuid import UUID

import pytest

from app.storage.paths import report_object_path, sanitize_filename, scan_input_object_path

WORKSPACE_ID = UUID("10000000-0000-0000-0000-000000000001")
SCAN_ID = UUID("20000000-0000-0000-0000-000000000002")
ARTIFACT_ID = UUID("30000000-0000-0000-0000-000000000003")
REPORT_ID = UUID("40000000-0000-0000-0000-000000000004")


def test_scan_input_path_is_canonical_and_sanitized() -> None:
    path = scan_input_object_path(
        WORKSPACE_ID,
        SCAN_ID,
        ARTIFACT_ID,
        "../My repo (final).zip",
    )

    assert path == f"{WORKSPACE_ID}/{SCAN_ID}/{ARTIFACT_ID}/My-repo-final-.zip"
    assert ".." not in path


def test_report_path_is_stable() -> None:
    assert report_object_path(WORKSPACE_ID, SCAN_ID, REPORT_ID, 2) == (
        f"{WORKSPACE_ID}/{SCAN_ID}/{REPORT_ID}/threatlens-audit-v2.pdf"
    )


def test_filename_requires_safe_characters() -> None:
    with pytest.raises(ValueError):
        sanitize_filename("../...")
