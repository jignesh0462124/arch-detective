"""
Executive summary writer — generates C-level readable scan summaries using Groq LLM.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_groq import ChatGroq
from tenacity import (
    after_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.agent.prompts.summary import summary_prompt
from app.config import settings

logger = logging.getLogger(__name__)

_llm: ChatGroq | None = None


def _get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            model=settings.GROQ_MODEL,
            temperature=0,
            api_key=settings.GROQ_API_KEY,
            max_retries=0,
        )
    return _llm


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    after=after_log(logger, logging.WARNING),
    reraise=True,
)
def _call_llm(payload: dict[str, Any]) -> dict[str, Any]:
    chain = summary_prompt | _get_llm()
    result = chain.invoke(payload)
    raw = result.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw.strip())
    return json.loads(raw)


def generate_executive_summary(scan_data: dict[str, Any]) -> dict[str, Any]:
    """
    Generate a C-level executive summary for a completed scan.

    Args:
        scan_data: dict with keys:
            target_name, scan_type, frameworks, findings (list),
            framework_scores (dict str→int)

    Returns:
        dict with keys: summary, risk_headline, overall_posture, top_priorities
    """
    findings: list[dict] = scan_data.get("findings", [])
    framework_scores: dict[str, int] = scan_data.get("framework_scores", {})

    severity_counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = str(f.get("severity", "")).lower()
        if sev in severity_counts:
            severity_counts[sev] += 1

    # Top 10 critical/high findings for context
    critical_high = [
        f for f in findings
        if str(f.get("severity", "")).lower() in ("critical", "high")
    ][:10]
    top_findings_text = "\n".join(
        f"- [{f.get('severity','?').upper()}] {f.get('title','')}: {str(f.get('description',''))[:150]}"
        for f in critical_high
    ) or "No critical or high findings."

    # Top violations (deduplicated by control)
    seen_controls: set[str] = set()
    top_violations: list[str] = []
    for f in findings:
        for v in f.get("violations", []):
            key = f"{v.get('framework','')}/{v.get('control_id','')}"
            if key not in seen_controls:
                seen_controls.add(key)
                top_violations.append(
                    f"- [{v.get('framework','')}] {v.get('control_id','')}: {v.get('violation_description','')[:150]}"
                )
            if len(top_violations) >= 10:
                break
        if len(top_violations) >= 10:
            break

    scores_text = "\n".join(
        f"  {fw.upper()}: {score}/100" for fw, score in framework_scores.items()
    ) or "  No framework scores computed."

    payload = {
        "target_name": scan_data.get("target_name", "Unknown"),
        "scan_type": scan_data.get("scan_type", "codebase"),
        "frameworks": ", ".join(scan_data.get("frameworks", [])),
        "total_findings": str(len(findings)),
        "critical_count": str(severity_counts["critical"]),
        "high_count": str(severity_counts["high"]),
        "medium_count": str(severity_counts["medium"]),
        "low_count": str(severity_counts["low"]),
        "framework_scores": scores_text,
        "top_findings": top_findings_text,
        "top_violations": "\n".join(top_violations) or "No violations mapped.",
    }

    fallback = {
        "summary": (
            f"The security assessment of {payload['target_name']} identified "
            f"{len(findings)} findings including "
            f"{severity_counts['critical']} critical and {severity_counts['high']} high severity issues. "
            "Immediate remediation is recommended for all critical findings."
        ),
        "risk_headline": f"{severity_counts['critical']} critical vulnerabilities require immediate attention.",
        "overall_posture": _compute_posture(severity_counts),
        "top_priorities": ["Remediate all critical findings immediately.", "Review high severity findings within 30 days."],
    }

    try:
        data = _call_llm(payload)
        return {
            "summary": data.get("summary") or fallback["summary"],
            "risk_headline": data.get("risk_headline") or fallback["risk_headline"],
            "overall_posture": data.get("overall_posture") or fallback["overall_posture"],
            "top_priorities": data.get("top_priorities") or fallback["top_priorities"],
        }
    except Exception:
        logger.exception("Executive summary generation failed for '%s'", payload["target_name"])
        return fallback


def _compute_posture(severity_counts: dict[str, int]) -> str:
    if severity_counts["critical"] > 0:
        return "Critical"
    if severity_counts["high"] > 5:
        return "High"
    if severity_counts["high"] > 0:
        return "Medium"
    if severity_counts["medium"] > 0:
        return "Low"
    return "Minimal"
