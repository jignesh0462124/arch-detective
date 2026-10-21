from __future__ import annotations

import json
from pathlib import Path
from typing import Any

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

SEMGREP_RULESETS = (
    "p/owasp-top-ten",
    "p/python",
    "p/javascript",
    "p/secrets",
    "p/supply-chain",
    "p/jwt",
    "p/sql-injection",
    "p/xss",
)
SEMGREP_SEVERITY = {
    "ERROR": Severity.CRITICAL,
    "WARNING": Severity.HIGH,
    "INFO": Severity.MEDIUM,
}


def _title(check_id: object) -> str:
    rule_name = str(check_id or "Semgrep finding").rsplit(".", maxsplit=1)[-1]
    return rule_name.replace("-", " ").replace("_", " ").title()


def parse_semgrep_output(output: str, root: Path) -> list[FindingCreate]:
    try:
        payload: Any = json.loads(output or "{}")
    except json.JSONDecodeError as exc:
        raise ScannerError("Semgrep returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ScannerError("Semgrep returned an unexpected response")

    findings: list[FindingCreate] = []
    results = payload.get("results")
    if not isinstance(results, list):
        return findings
    for result in results[:MAX_FINDINGS_PER_SCANNER]:
        if not isinstance(result, dict):
            continue
        extra = first_mapping(result.get("extra"))
        metadata = first_mapping(extra.get("metadata"))
        start = first_mapping(result.get("start"))
        cwe = metadata.get("cwe")
        findings.append(
            create_finding(
                source=FindingSource.SEMGREP,
                title=_title(result.get("check_id")),
                description=extra.get("message"),
                severity=SEMGREP_SEVERITY.get(
                    str(extra.get("severity", "")).upper(),
                    Severity.LOW,
                ),
                root=root,
                cwe_id=cwe,
                file_path=result.get("path"),
                line_number=start.get("line"),
                code_snippet=extra.get("lines"),
                remediation=extra.get("fix") or metadata.get("fix"),
            )
        )
    return findings


def run_semgrep(repo_path: str) -> list[FindingCreate]:
    root = validate_repository_path(repo_path)
    command = ["semgrep", "scan"]
    for ruleset in SEMGREP_RULESETS:
        command.extend(("--config", ruleset))
    command.extend(
        (
            "--json",
            "--quiet",
            "--metrics=off",
            "--disable-version-check",
            str(root),
        )
    )
    result = run_scanner_command(
        command,
        cwd=root,
        accepted_returncodes=(0, 1),
        # Registry rules may need to be downloaded into the scanner cache.
        network_access=True,
    )
    return parse_semgrep_output(result.stdout, root)
