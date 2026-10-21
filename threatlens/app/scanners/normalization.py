from __future__ import annotations

import hashlib
import re
from pathlib import Path
from uuid import UUID

from app.models.finding import FindingSource, Severity
from app.schemas.finding import FindingCreate
from app.scanners.base import bounded_text, relative_finding_path

SEVERITY_ORDER = {
    Severity.LOW: 1,
    Severity.MEDIUM: 2,
    Severity.HIGH: 3,
    Severity.CRITICAL: 4,
}
_CWE_PATTERN = re.compile(r"\bCWE[-\s:]*(\d+)\b", re.IGNORECASE)


def normalize_severity(value: object, *, default: Severity = Severity.LOW) -> Severity:
    normalized = str(value).strip().lower()
    aliases = {
        "critical": Severity.CRITICAL,
        "error": Severity.CRITICAL,
        "high": Severity.HIGH,
        "warning": Severity.HIGH,
        "moderate": Severity.MEDIUM,
        "medium": Severity.MEDIUM,
        "info": Severity.LOW,
        "informational": Severity.LOW,
        "low": Severity.LOW,
    }
    return aliases.get(normalized, default)


def normalize_cwe(value: object) -> str | None:
    if isinstance(value, list):
        value = next((item for item in value if item), None)
    if isinstance(value, dict):
        value = value.get("id")
    if value is None:
        return None
    match = _CWE_PATTERN.search(str(value))
    if match:
        return f"CWE-{match.group(1)}"
    raw = str(value).strip()
    if raw.isdigit():
        return f"CWE-{raw}"
    return None


def finding_fingerprint(
    *,
    source: FindingSource,
    title: str,
    file_path: str | None,
    line_number: int | None,
    cwe_id: str | None,
) -> str:
    identity = "\x1f".join(
        (
            source.value,
            title.casefold(),
            (file_path or "").casefold(),
            str(line_number or ""),
            (cwe_id or "").casefold(),
        )
    )
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def create_finding(
    *,
    source: FindingSource,
    title: object,
    description: object,
    severity: Severity,
    root: Path | None = None,
    scan_id: UUID | None = None,
    cwe_id: object = None,
    cve_id: object = None,
    file_path: object = None,
    line_number: object = None,
    code_snippet: object = None,
    remediation: object = None,
) -> FindingCreate:
    normalized_title = bounded_text(title, 255, default="Security finding")
    normalized_description = bounded_text(
        description,
        16_000,
        default="A security scanner reported a potential vulnerability.",
    )
    normalized_path = (
        relative_finding_path(file_path, root)
        if root is not None
        else bounded_text(file_path, 1024) or None
    )
    try:
        normalized_line = int(line_number) if line_number is not None else None
    except (TypeError, ValueError):
        normalized_line = None
    if normalized_line is not None and normalized_line < 1:
        normalized_line = None
    normalized_cwe = normalize_cwe(cwe_id)
    normalized_cve = bounded_text(cve_id, 32) or None
    fingerprint = finding_fingerprint(
        source=source,
        title=normalized_title,
        file_path=normalized_path,
        line_number=normalized_line,
        cwe_id=normalized_cwe,
    )
    return FindingCreate(
        scan_id=scan_id,
        title=normalized_title,
        description=normalized_description,
        severity=severity,
        source=source,
        cwe_id=normalized_cwe,
        cve_id=normalized_cve,
        file_path=normalized_path,
        line_number=normalized_line,
        code_snippet=bounded_text(code_snippet, 8_000) or None,
        remediation=bounded_text(remediation, 8_000) or None,
        fingerprint=fingerprint,
    )


def deduplicate_findings(findings: list[FindingCreate]) -> list[FindingCreate]:
    # Contract (see test_deduplication_keeps_highest_severity): same
    # file+line+CWE collapses to the highest severity, even across
    # different titles/sources. Distinct rules are preserved via the
    # canonical finding_fingerprint stored on each Finding, not via dedup.
    deduplicated: dict[
        tuple[str | None, int | None, str | None, str | None],
        FindingCreate,
    ] = {}
    for finding in findings:
        sparse_identity = (
            finding.fingerprint
            if finding.line_number is None and finding.cwe_id is None
            else None
        )
        key = (
            finding.file_path.casefold() if finding.file_path else None,
            finding.line_number,
            finding.cwe_id.casefold() if finding.cwe_id else None,
            sparse_identity,
        )
        current = deduplicated.get(key)
        if current is None or SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[
            current.severity
        ]:
            deduplicated[key] = finding
    return list(deduplicated.values())
