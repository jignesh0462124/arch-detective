from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from app.ingestion.code_extractor import EXCLUDED_DIRS
from app.models.finding import FindingSource, Severity
from app.schemas.finding import FindingCreate
from app.scanners.base import (
    MAX_FINDINGS_PER_SCANNER,
    ScannerError,
    run_scanner_command,
    validate_repository_path,
)
from app.scanners.normalization import create_finding, normalize_severity

MAX_MANIFESTS_PER_SCAN = 20


def _find_manifests(root: Path, names: set[str]) -> list[Path]:
    manifests: list[Path] = []
    for current_root, directories, files in os.walk(root, followlinks=False):
        directories[:] = [
            directory
            for directory in directories
            if directory not in EXCLUDED_DIRS
            and not (Path(current_root) / directory).is_symlink()
        ]
        for filename in files:
            if filename.lower() not in names:
                continue
            path = Path(current_root) / filename
            if not path.is_symlink():
                manifests.append(path)
            if len(manifests) >= MAX_MANIFESTS_PER_SCAN:
                return sorted(manifests)
    return sorted(manifests)


def _first_cve(vulnerability: dict[str, Any]) -> str | None:
    vulnerability_id = str(vulnerability.get("id") or "")
    if vulnerability_id.upper().startswith("CVE-"):
        return vulnerability_id.upper()
    aliases = vulnerability.get("aliases")
    if isinstance(aliases, list):
        return next(
            (
                str(alias).upper()
                for alias in aliases
                if str(alias).upper().startswith("CVE-")
            ),
            None,
        )
    return None


def parse_pip_audit_output(
    output: str,
    root: Path,
    manifest: Path,
) -> list[FindingCreate]:
    try:
        payload: Any = json.loads(output or "[]")
    except json.JSONDecodeError as exc:
        raise ScannerError("pip-audit returned invalid JSON") from exc
    dependencies = payload.get("dependencies", []) if isinstance(payload, dict) else payload
    if not isinstance(dependencies, list):
        raise ScannerError("pip-audit returned an unexpected response")

    findings: list[FindingCreate] = []
    for dependency in dependencies:
        if not isinstance(dependency, dict):
            continue
        name = str(dependency.get("name") or "unknown")
        version = str(dependency.get("version") or "unknown")
        vulnerabilities = dependency.get("vulns")
        if not isinstance(vulnerabilities, list):
            continue
        for vulnerability in vulnerabilities:
            if len(findings) >= MAX_FINDINGS_PER_SCANNER:
                return findings
            if not isinstance(vulnerability, dict):
                continue
            vulnerability_id = str(vulnerability.get("id") or "known vulnerability")
            fixes = vulnerability.get("fix_versions")
            fix_text = ", ".join(map(str, fixes)) if isinstance(fixes, list) else ""
            findings.append(
                create_finding(
                    source=FindingSource.PIP_AUDIT,
                    title=f"Vulnerable dependency: {name} {version}",
                    description=(
                        str(vulnerability.get("description") or vulnerability_id)
                    ),
                    severity=Severity.HIGH,
                    root=root,
                    cve_id=_first_cve(vulnerability),
                    file_path=manifest,
                    code_snippet=f"{name}=={version}",
                    remediation=(
                        f"Upgrade {name} to {fix_text}."
                        if fix_text
                        else f"Upgrade or replace {name} and verify {vulnerability_id}."
                    ),
                )
            )
    return findings


def run_pip_audit(repo_path: str) -> list[FindingCreate]:
    root = validate_repository_path(repo_path)
    manifests = _find_manifests(root, {"requirements.txt", "requirements-dev.txt"})
    findings: list[FindingCreate] = []
    for manifest in manifests:
        result = run_scanner_command(
            [
                "pip-audit",
                "-r",
                str(manifest),
                "--format",
                "json",
                "--progress-spinner",
                "off",
            ],
            cwd=manifest.parent,
            accepted_returncodes=(0, 1),
            network_access=True,
        )
        findings.extend(parse_pip_audit_output(result.stdout, root, manifest))
        if len(findings) >= MAX_FINDINGS_PER_SCANNER:
            break
    return findings[:MAX_FINDINGS_PER_SCANNER]


def _npm_vulnerability_description(name: str, value: dict[str, Any]) -> str:
    via = value.get("via")
    details: list[str] = []
    if isinstance(via, list):
        for item in via:
            if isinstance(item, dict) and item.get("title"):
                details.append(str(item["title"]))
    return "; ".join(details[:5]) or f"npm reported {name} as vulnerable."


def parse_npm_audit_output(
    output: str,
    root: Path,
    manifest: Path,
) -> list[FindingCreate]:
    try:
        payload: Any = json.loads(output or "{}")
    except json.JSONDecodeError as exc:
        raise ScannerError("npm audit returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ScannerError("npm audit returned an unexpected response")

    findings: list[FindingCreate] = []
    vulnerabilities = payload.get("vulnerabilities")
    if isinstance(vulnerabilities, dict):
        for name, raw in list(vulnerabilities.items())[:MAX_FINDINGS_PER_SCANNER]:
            if not isinstance(raw, dict):
                continue
            findings.append(
                create_finding(
                    source=FindingSource.NPM_AUDIT,
                    title=f"Vulnerable npm dependency: {name}",
                    description=_npm_vulnerability_description(str(name), raw),
                    severity=normalize_severity(raw.get("severity")),
                    root=root,
                    file_path=manifest,
                    code_snippet=str(name),
                    remediation=(
                        f"Upgrade to {raw['fixAvailable']}."
                        if isinstance(raw.get("fixAvailable"), str)
                        else "Upgrade to a patched version and regenerate the lockfile."
                    ),
                )
            )
        return findings

    advisories = payload.get("advisories")
    if isinstance(advisories, dict):
        for raw in list(advisories.values())[:MAX_FINDINGS_PER_SCANNER]:
            if not isinstance(raw, dict):
                continue
            cves = raw.get("cves")
            cve = cves[0] if isinstance(cves, list) and cves else None
            findings.append(
                create_finding(
                    source=FindingSource.NPM_AUDIT,
                    title=raw.get("title") or "Vulnerable npm dependency",
                    description=raw.get("overview"),
                    severity=normalize_severity(raw.get("severity")),
                    root=root,
                    cve_id=cve,
                    file_path=manifest,
                    remediation=raw.get("recommendation"),
                )
            )
    return findings


def run_npm_audit(repo_path: str) -> list[FindingCreate]:
    root = validate_repository_path(repo_path)
    manifests = _find_manifests(root, {"package-lock.json"})
    findings: list[FindingCreate] = []
    for manifest in manifests:
        result = run_scanner_command(
            [
                "npm",
                "audit",
                "--json",
                "--omit=dev",
                "--ignore-scripts",
            ],
            cwd=manifest.parent,
            accepted_returncodes=(0, 1),
            network_access=True,
        )
        findings.extend(parse_npm_audit_output(result.stdout, root, manifest))
        if len(findings) >= MAX_FINDINGS_PER_SCANNER:
            break
    return findings[:MAX_FINDINGS_PER_SCANNER]
