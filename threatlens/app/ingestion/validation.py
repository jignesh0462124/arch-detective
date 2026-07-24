from __future__ import annotations

import re
from pathlib import PurePath

from app.models.scan import ScanType
from app.models.scan_artifact import ArtifactKind

_UPLOAD_TYPES: dict[ScanType, dict[ArtifactKind, frozenset[str]]] = {
    ScanType.CODEBASE: {
        ArtifactKind.SOURCE_ZIP: frozenset(
            {
                "application/zip",
                "application/x-zip-compressed",
                "application/octet-stream",
            }
        ),
    },
    ScanType.ARCHITECTURE: {
        ArtifactKind.ARCHITECTURE_YAML: frozenset(
            {
                "application/json",
                "application/yaml",
                "application/x-yaml",
                "text/json",
                "text/plain",
                "text/yaml",
                "text/x-yaml",
            }
        ),
    },
    ScanType.LOGS: {
        ArtifactKind.LOG_BUNDLE: frozenset(
            {
                "application/json",
                "application/x-ndjson",
                "text/csv",
                "text/plain",
                "text/x-log",
            }
        ),
    },
    ScanType.FULL: {
        ArtifactKind.SOURCE_ZIP: frozenset(
            {
                "application/zip",
                "application/x-zip-compressed",
                "application/octet-stream",
            }
        ),
    },
}

_EXTENSIONS: dict[ArtifactKind, frozenset[str]] = {
    ArtifactKind.SOURCE_ZIP: frozenset({".zip"}),
    ArtifactKind.ARCHITECTURE_YAML: frozenset({".json", ".yaml", ".yml"}),
    ArtifactKind.LOG_BUNDLE: frozenset({".csv", ".json", ".jsonl", ".log", ".txt"}),
    ArtifactKind.OTHER: frozenset(),
}

SHA256_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")


def validate_upload_contract(
    scan_type: ScanType,
    artifact_kind: ArtifactKind,
    filename: str,
    content_type: str,
) -> None:
    allowed_kinds = _UPLOAD_TYPES.get(scan_type)
    if allowed_kinds is None or artifact_kind not in allowed_kinds:
        raise ValueError("Artifact kind does not match the selected scan type")

    normalized_type = content_type.split(";", maxsplit=1)[0].strip().lower()
    if normalized_type not in allowed_kinds[artifact_kind]:
        raise ValueError("Content type is not allowed for this scan type")

    suffix = PurePath(filename.replace("\\", "/")).suffix.lower()
    if suffix not in _EXTENSIONS[artifact_kind]:
        raise ValueError("Filename extension does not match the artifact kind")


def normalize_sha256(value: str) -> str:
    if not SHA256_PATTERN.fullmatch(value):
        raise ValueError("sha256 must contain exactly 64 hexadecimal characters")
    return value.lower()
