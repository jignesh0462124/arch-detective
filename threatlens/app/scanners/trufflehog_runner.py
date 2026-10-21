from __future__ import annotations

import json
from pathlib import Path

from app.models.finding import FindingSource, Severity
from app.schemas.finding import FindingCreate
from app.scanners.base import (
    MAX_FINDINGS_PER_SCANNER,
    first_mapping,
    run_scanner_command,
    validate_repository_path,
)
from app.scanners.normalization import create_finding


def parse_trufflehog_output(output: str, root: Path) -> list[FindingCreate]:
    findings: list[FindingCreate] = []
    for line in output.splitlines():
        if len(findings) >= MAX_FINDINGS_PER_SCANNER:
            break
        stripped = line.strip()
        if not stripped:
            continue
        try:
            result = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if not isinstance(result, dict):
            continue
        detector = str(result.get("DetectorName") or "Unknown credential")
        source_metadata = first_mapping(result.get("SourceMetadata"))
        source_data = first_mapping(source_metadata.get("Data"))
        filesystem = first_mapping(source_data.get("Filesystem"))
        findings.append(
            create_finding(
                source=FindingSource.TRUFFLEHOG,
                title=f"Hard-coded {detector} credential",
                description=(
                    f"TruffleHog detected a {detector} credential in source control. "
                    "The secret value is intentionally omitted from this finding."
                ),
                severity=Severity.CRITICAL,
                root=root,
                cwe_id="CWE-798",
                file_path=filesystem.get("file"),
                line_number=filesystem.get("line"),
                remediation=(
                    "Revoke and rotate the credential, remove it from repository history, "
                    "and load the replacement from an approved secret manager."
                ),
            )
        )
    return findings


def run_trufflehog(repo_path: str) -> list[FindingCreate]:
    root = validate_repository_path(repo_path)
    result = run_scanner_command(
        [
            "trufflehog",
            "filesystem",
            str(root),
            "--json",
            "--no-update",
            "--results=verified,unknown",
        ],
        cwd=root,
        accepted_returncodes=(0, 1),
        network_access=False,
    )
    return parse_trufflehog_output(result.stdout, root)
