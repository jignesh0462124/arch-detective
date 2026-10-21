"""Validate model suggestions against uploaded source; never invent evidence."""
from __future__ import annotations

import re
from typing import Any


def ground_ai_findings(values: Any, files: list[dict[str, str]]) -> list[dict[str, Any]]:
    if not isinstance(values, list):
        return []
    sources = {f["path"].replace("\\", "/"): f["content"] for f in files}
    grounded = []
    for value in values:
        if not isinstance(value, dict):
            continue
        title = value.get("title")
        path = value.get("file_path")
        snippet = value.get("code_snippet")
        severity = str(value.get("severity", "")).lower()
        if not isinstance(title, str) or not title.strip() or not isinstance(path, str):
            continue
        path = path.replace("\\", "/")
        content = sources.get(path)
        if content is None or not isinstance(snippet, str) or not snippet.strip():
            continue
        # Require literal source evidence. A model-provided line number alone
        # cannot establish that the suggested vulnerability exists.
        offset = content.find(snippet)
        if offset < 0 or severity not in {"critical", "high", "medium", "low"}:
            continue
        cwe = str(value.get("cwe_id") or "").upper()
        grounded.append({
            "title": title.strip(), "severity": severity,
            "description": value.get("description") if isinstance(value.get("description"), str) else "Review this source-backed model suggestion.",
            "file_path": path, "line_number": content.count("\n", 0, offset) + 1,
            "code_snippet": snippet, "cwe_id": cwe if re.fullmatch(r"CWE-\d+", cwe) else None,
            "violations": [], "source": "ai_source_verified",
        })
    return grounded


def build_evidence_summary(target: str, findings: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {severity: sum(f.get("severity") == severity for f in findings)
              for severity in ("critical", "high", "medium", "low")}
    posture = next((s.title() for s, count in counts.items() if count), "Minimal")
    return {
        "summary": f"Automated analysis of {target} recorded {len(findings)} potential security findings "
                   f"({counts['critical']} critical, {counts['high']} high, {counts['medium']} medium, {counts['low']} low). "
                   "These are static-analysis candidates, not confirmed exploits or a compliance certification. "
                   "No findings does not prove the project is secure; review scan coverage and validate manually.",
        "risk_headline": f"{posture} recorded risk in {target}" if findings else "No findings detected within scan coverage",
        "overall_posture": posture,
        "top_priorities": [f["title"] for f in sorted(findings, key=lambda f: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(f.get("severity"), 4))[:4]],
    }
