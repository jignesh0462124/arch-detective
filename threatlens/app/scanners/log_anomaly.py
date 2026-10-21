from __future__ import annotations

import re
from collections.abc import Mapping
from urllib.parse import unquote_plus

from app.config import settings
from app.models.finding import FindingSource, Severity
from app.schemas.finding import FindingCreate
from app.scanners.normalization import create_finding

AUTH_FAILURE_PATTERN = re.compile(
    r"\b(authentication|login|signin|password|credential)\b.{0,80}"
    r"\b(fail(?:ed|ure)?|invalid|denied|unauthorized)\b",
    re.IGNORECASE,
)
SQL_INJECTION_PATTERN = re.compile(
    r"(?:\bunion(?:\s|/\*.*?\*/)+select\b|"
    r"\bor\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+|"
    r"\bdrop\s+table\b|"
    r"\bxp_cmdshell\b|"
    r"(?:'|%27)\s*--)",
    re.IGNORECASE,
)
UNUSUAL_METHODS = frozenset({"CONNECT", "PROPFIND", "TRACE"})
BRUTE_FORCE_THRESHOLD = 50


def _text(entry: Mapping[str, object], key: str, maximum: int = 8192) -> str:
    value = entry.get(key)
    return str(value)[:maximum] if value is not None else ""


def _status(entry: Mapping[str, object]) -> int | None:
    try:
        return int(entry.get("status"))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _statistical_anomaly_count(entries: list[Mapping[str, object]]) -> int:
    if len(entries) < 20:
        return 0
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return 0

    features = []
    for entry in entries:
        status = _status(entry) or 0
        method = _text(entry, "method", 32).upper()
        path = _text(entry, "path", 2048)
        message = _text(entry, "message")
        features.append(
            [
                float(status),
                float(status >= 500),
                float(method in UNUSUAL_METHODS),
                float(len(path)),
                float(len(message)),
            ]
        )
    model = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=42,
        n_jobs=1,
    )
    predictions = model.fit_predict(features)
    return sum(int(prediction == -1) for prediction in predictions)


def detect_log_anomalies(
    log_entries: list[dict[str, object]],
    *,
    include_statistical: bool = False,
) -> list[FindingCreate]:
    entries: list[Mapping[str, object]] = list(
        log_entries[: settings.MAX_LOG_ENTRIES]
    )
    findings: list[FindingCreate] = []

    auth_failures = [
        entry
        for entry in entries
        if _status(entry) in {401, 403}
        or AUTH_FAILURE_PATTERN.search(_text(entry, "message")) is not None
    ]
    if len(auth_failures) > BRUTE_FORCE_THRESHOLD:
        findings.append(
            create_finding(
                source=FindingSource.LOG_ANOMALY,
                title="Potential brute-force authentication attack",
                description=(
                    f"{len(auth_failures)} authentication failures were observed; "
                    f"the alert threshold is {BRUTE_FORCE_THRESHOLD}."
                ),
                severity=Severity.HIGH,
                cwe_id="CWE-307",
                remediation=(
                    "Apply rate limits and account lockout controls, then investigate "
                    "the source addresses and affected identities."
                ),
            )
        )

    injection_hits = []
    for entry in entries:
        candidate = f"{_text(entry, 'path', 2048)} {_text(entry, 'message')}"
        try:
            decoded = unquote_plus(candidate)[:10_240]
        except ValueError:
            decoded = candidate[:10_240]
        if SQL_INJECTION_PATTERN.search(decoded):
            injection_hits.append(entry)
    if injection_hits:
        findings.append(
            create_finding(
                source=FindingSource.LOG_ANOMALY,
                title="SQL injection attempts detected in request logs",
                description=(
                    f"{len(injection_hits)} requests matched SQL injection indicators."
                ),
                severity=Severity.CRITICAL,
                cwe_id="CWE-89",
                remediation=(
                    "Block the malicious requests, inspect affected endpoints, and ensure "
                    "all database operations use parameterized queries."
                ),
            )
        )

    unusual = [
        entry
        for entry in entries
        if _text(entry, "method", 32).upper() in UNUSUAL_METHODS
    ]
    if unusual:
        methods = sorted(
            {
                _text(entry, "method", 32).upper()
                for entry in unusual
                if _text(entry, "method", 32)
            }
        )
        findings.append(
            create_finding(
                source=FindingSource.LOG_ANOMALY,
                title="Unusual HTTP methods detected",
                description=(
                    f"{len(unusual)} requests used potentially unsafe methods: "
                    f"{', '.join(methods)}."
                ),
                severity=Severity.MEDIUM,
                cwe_id="CWE-749",
                remediation=(
                    "Disable unused HTTP methods at the reverse proxy and application."
                ),
            )
        )

    if include_statistical:
        anomaly_count = _statistical_anomaly_count(entries)
        if anomaly_count:
            findings.append(
                create_finding(
                    source=FindingSource.LOG_ANOMALY,
                    title="Statistically anomalous log activity",
                    description=(
                        f"Isolation Forest classified {anomaly_count} of "
                        f"{len(entries)} entries as anomalous."
                    ),
                    severity=Severity.MEDIUM,
                    cwe_id="CWE-20",
                    remediation=(
                        "Review the anomalous requests alongside identity, network, and "
                        "application telemetry before escalating."
                    ),
                )
            )
    return findings
