import re
from pathlib import PurePath
from uuid import UUID


def sanitize_filename(filename: str) -> str:
    basename = PurePath(filename.replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", basename).strip(".-")
    if not cleaned:
        raise ValueError("Filename does not contain any safe characters")
    return cleaned[:255]


def scan_input_object_path(
    workspace_id: UUID,
    scan_id: UUID,
    artifact_id: UUID,
    filename: str,
) -> str:
    return "/".join(
        (
            str(workspace_id),
            str(scan_id),
            str(artifact_id),
            sanitize_filename(filename),
        ),
    )


def report_object_path(
    workspace_id: UUID,
    scan_id: UUID,
    report_id: UUID,
    version: int,
) -> str:
    if version < 1:
        raise ValueError("Report version must be positive")
    return "/".join(
        (
            str(workspace_id),
            str(scan_id),
            str(report_id),
            f"threatlens-audit-v{version}.pdf",
        ),
    )
