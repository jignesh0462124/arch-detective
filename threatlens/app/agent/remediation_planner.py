"""
Remediation planner — generates ordered, actionable remediation steps for a finding.
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

from app.agent.prompts.remediation import remediation_prompt
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
    chain = remediation_prompt | _get_llm()
    result = chain.invoke(payload)
    raw = result.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw.strip())
    return json.loads(raw)


def _severity_to_priority(severity: str) -> str:
    """Derive remediation priority from severity when LLM is unavailable."""
    sev = severity.lower()
    if sev == "critical":
        return "immediate"
    if sev == "high":
        return "short-term"
    return "long-term"


def plan_remediation(
    finding_dict: dict[str, Any],
    violations: list[dict[str, Any]],
) -> tuple[list[str], str]:
    """
    Generate ordered remediation steps for a finding.

    Returns:
        (steps: list[str], priority: str)
    """
    violations_summary = "\n".join(
        f"- [{v.get('framework','')}] {v.get('control_id','')} — {v.get('violation_description','')[:200]}"
        for v in violations[:5]
    ) or "No framework violations mapped."

    payload = {
        "title": finding_dict.get("title", ""),
        "severity": str(finding_dict.get("severity", "")),
        "cwe_id": finding_dict.get("cwe_id") or "N/A",
        "file_path": finding_dict.get("file_path") or "N/A",
        "line_number": str(finding_dict.get("line_number")) if finding_dict.get("line_number") else "N/A",
        "description": (finding_dict.get("description") or "")[:500],
        "violations_summary": violations_summary,
        "code_snippet": (finding_dict.get("code_snippet") or "No snippet available.")[:1000],
    }

    try:
        data = _call_llm(payload)
        steps = data.get("steps") or []
        priority = data.get("priority") or _severity_to_priority(payload["severity"])
        # Validate
        if not isinstance(steps, list):
            steps = [str(steps)]
        steps = [str(s) for s in steps[:7]]  # cap at 7
        if priority not in ("immediate", "short-term", "long-term"):
            priority = _severity_to_priority(payload["severity"])
        return steps, priority
    except Exception:
        logger.exception("Remediation planning failed for '%s'", finding_dict.get("title"))
        fallback_step = finding_dict.get("remediation", "Review and fix the identified issue.")
        return [fallback_step] if fallback_step else ["Review and fix the identified issue."], \
               _severity_to_priority(payload["severity"])
