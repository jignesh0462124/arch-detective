from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.ingestion.code_extractor import EXCLUDED_DIRS
from app.models.finding import FindingSource, Severity
from app.schemas.finding import FindingCreate
from app.scanners.base import (
    MAX_FINDINGS_PER_SCANNER,
    ScannerError,
    first_mapping,
    run_scanner_command,
    validate_repository_path,
)
from app.scanners.normalization import create_finding


def map_bandit_severity(severity: object, confidence: object) -> Severity:
    normalized_severity = str(severity).upper()
    normalized_confidence = str(confidence).upper()
    if normalized_severity == "HIGH" and normalized_confidence == "HIGH":
        return Severity.CRITICAL
    if normalized_severity == "HIGH":
        return Severity.HIGH
    if normalized_severity == "MEDIUM":
        return Severity.MEDIUM
    return Severity.LOW


def parse_bandit_output(output: str, root: Path) -> list[FindingCreate]:
    try:
        payload: Any = json.loads(output or "{}")
    except json.JSONDecodeError as exc:
        raise ScannerError("Bandit returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ScannerError("Bandit returned an unexpected response")

    findings: list[FindingCreate] = []
    results = payload.get("results")
    if not isinstance(results, list):
        return findings
    for result in results[:MAX_FINDINGS_PER_SCANNER]:
        if not isinstance(result, dict):
            continue
        cwe = first_mapping(result.get("issue_cwe")).get("id")
        title = str(result.get("test_name") or result.get("test_id") or "Bandit finding")
        findings.append(
            create_finding(
                source=FindingSource.BANDIT,
                title=title.replace("_", " ").title(),
                description=result.get("issue_text"),
                severity=map_bandit_severity(
                    result.get("issue_severity"),
                    result.get("issue_confidence"),
                ),
                root=root,
                cwe_id=cwe,
                file_path=result.get("filename"),
                line_number=result.get("line_number"),
                code_snippet=result.get("code"),
                remediation=result.get("more_info"),
            )
        )
    return findings


def run_bandit(repo_path: str) -> list[FindingCreate]:
    root = validate_repository_path(repo_path)
    command = [
        "bandit",
        "-r",
        str(root),
        "-f",
        "json",
        "-q",
        "-x",
        ",".join(sorted(EXCLUDED_DIRS)),
    ]
    result = run_scanner_command(
        command,
        cwd=root,
        accepted_returncodes=(0, 1),
        network_access=False,
    )
    return parse_bandit_output(result.stdout, root)
