"""
Compliance mapper — core LLM pipeline for mapping findings to compliance controls.

Pipeline:
  1. RAG retrieve top-12 controls for the finding
  2. Format controls + finding into the compliance prompt
  3. Call Groq Llama 3.1 70B (temperature=0)
  4. Parse with Pydantic into ComplianceMappingResult
  5. Retry with tenacity on failures
  6. Persist ComplianceViolation rows in the database
"""
from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import (
    after_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings
from app.models.compliance_violation import ComplianceViolation
from app.models.finding import Finding
from app.rag.retriever import retrieve_relevant_controls

logger = logging.getLogger(__name__)

# Regex that finds common secret patterns to redact before sending to LLM
_SECRET_RE = re.compile(
    r"""(?ix)
    (
        (?:password|passwd|secret|token|api[_\-]?key|auth[_\-]?key|private[_\-]?key)
        \s*[=:]\s*
    )
    (\S{4,})
    """,
)

_CREDIT_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,16}\b")


def _redact_sensitive_content(text: str) -> str:
    """Redact detected secrets and credit card numbers before sending to Groq."""
    if not text:
        return ""
    text = _SECRET_RE.sub(r"\1[REDACTED]", text)
    text = _CREDIT_CARD_RE.sub("[REDACTED-CC]", text)
    return text


# ── Pydantic output schema ────────────────────────────────────────────────────


class FrameworkViolation(BaseModel):
    framework: str
    control_id: str
    control_title: str
    violation_description: str
    evidence: str
    rag_chunk_ids: list[str] = Field(default_factory=list)


class ComplianceMappingResult(BaseModel):
    violations: list[FrameworkViolation] = Field(default_factory=list)
    cvss_score: float = Field(ge=0.0, le=10.0)
    cvss_vector: str = ""
    remediation_steps: list[str] = Field(default_factory=list)
    remediation_priority: str = "long-term"


# ── LLM client (lazy singleton) ──────────────────────────────────────────────

_llm: ChatGroq | None = None


def _get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            model=settings.GROQ_MODEL,
            temperature=0,
            api_key=settings.GROQ_API_KEY,
            max_retries=0,  # tenacity handles retries
        )
    return _llm


# ── Retry decorator ──────────────────────────────────────────────────────────

_retryable = retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    after=after_log(logger, logging.WARNING),
    reraise=True,
)


_DEFAULT_FRAMEWORK_CONTROLS = [
    {
        "id": "def-gdpr-32",
        "framework": "GDPR",
        "control_id": "Art.32",
        "control_title": "Security of processing",
        "text": "Implement technical and organizational measures to ensure security, encryption of personal data, and confidentiality.",
    },
    {
        "id": "def-soc2-cc61",
        "framework": "SOC2",
        "control_id": "CC6.1",
        "control_title": "Logical access security controls",
        "text": "The entity implements logical access security controls to protect information assets from unauthorized access.",
    },
    {
        "id": "def-soc2-cc66",
        "framework": "SOC2",
        "control_id": "CC6.6",
        "control_title": "Protection against vulnerabilities and injection",
        "text": "The entity implements controls to protect against code injection, unauthorized modification, and malicious activity.",
    },
    {
        "id": "def-nist-ac1",
        "framework": "NIST_CSF",
        "control_id": "PR.AC-1",
        "control_title": "Identity and access management",
        "text": "Identities and credentials are protected. Hardcoded secrets, unauthenticated endpoints, and weak auth must be prevented.",
    },
    {
        "id": "def-nist-ds1",
        "framework": "NIST_CSF",
        "control_id": "PR.DS-1",
        "control_title": "Data-at-rest protection",
        "text": "Data-at-rest is protected using strong cryptographic algorithms. Weak hashes (e.g. MD5) are not permitted.",
    },
    {
        "id": "def-pci-65",
        "framework": "PCI_DSS",
        "control_id": "Req.6.5",
        "control_title": "Address common software vulnerabilities",
        "text": "Address common software vulnerabilities in code, including SQL injection, command execution, and broken auth.",
    },
]


def _get_default_framework_controls(frameworks: list[str]) -> list[dict[str, Any]]:
    fws = {f.lower().replace("-", "_").replace(" ", "") for f in frameworks}
    if not fws:
        return _DEFAULT_FRAMEWORK_CONTROLS
    matching = [
        c for c in _DEFAULT_FRAMEWORK_CONTROLS
        if c["framework"].lower().replace("-", "_").replace(" ", "") in fws
        or any(fw in c["framework"].lower() for fw in fws)
    ]
    return matching or _DEFAULT_FRAMEWORK_CONTROLS


def _build_controls_context(controls: list[dict[str, Any]]) -> str:
    """Format RAG results into a prompt-friendly block."""
    lines: list[str] = []
    for ctrl in controls:
        chunk_id = ctrl.get("id", "")
        framework = ctrl.get("framework", "")
        control_id = ctrl.get("control_id", "")
        title = ctrl.get("control_title", "")
        text = ctrl.get("text", "")[:500]  # cap per control to stay in token budget
        lines.append(
            f"[chunk_id={chunk_id}] [{framework}] {control_id} — {title}\n{text}"
        )
    return "\n\n".join(lines) if lines else "No controls retrieved."


@_retryable
def _call_llm_for_compliance(payload: dict[str, Any]) -> ComplianceMappingResult:
    """Call Groq and parse the structured output. Raises on parse failure."""
    from app.agent.prompts.compliance import compliance_prompt

    llm = _get_llm()
    chain = compliance_prompt | llm

    result = chain.invoke(payload)
    raw_content: str = result.content

    # Strip markdown fences if present
    raw_content = raw_content.strip()
    if raw_content.startswith("```"):
        raw_content = re.sub(r"^```[a-z]*\n?", "", raw_content)
        raw_content = re.sub(r"\n?```$", "", raw_content.strip())

    import json

    data = json.loads(raw_content)
    return ComplianceMappingResult.model_validate(data)


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def map_finding_to_compliance(
    finding: Any,
    frameworks: list[str],
) -> ComplianceMappingResult:
    """
    Synchronous compliance mapper — designed for Celery workers and test pipelines.

    Retrieves relevant compliance controls via RAG, calls the Groq LLM,
    and returns a structured ComplianceMappingResult.
    """
    f_id = _get_val(finding, "id", "")
    f_title = _get_val(finding, "title", "")
    f_desc = _get_val(finding, "description", "")
    f_cwe = _get_val(finding, "cwe_id", "")
    f_cve = _get_val(finding, "cve_id", "")
    f_file = _get_val(finding, "file_path", "")
    f_line = _get_val(finding, "line_number", None)
    f_sev = _get_val(finding, "severity", "medium")
    f_sev_str = f_sev.value if hasattr(f_sev, "value") else str(f_sev)
    f_source = _get_val(finding, "source", "unknown")
    f_snippet = _get_val(finding, "code_snippet", "No snippet available.")
    f_remediation = _get_val(finding, "remediation", "")

    # Build finding text for RAG query
    finding_text = f"{f_title}. {f_desc}"
    if f_cwe:
        finding_text += f" CWE: {f_cwe}."

    # RAG retrieval
    try:
        controls = retrieve_relevant_controls(
            finding_text=finding_text,
            frameworks=frameworks if frameworks else None,
            top_k=12,
        )
    except Exception:
        logger.warning("RAG retrieval unavailable for finding %s; using framework baseline controls", f_id)
        controls = []

    if not controls:
        controls = _get_default_framework_controls(frameworks or [])

    # Redact sensitive content before sending to external LLM
    safe_description = _redact_sensitive_content(f_desc or "")
    safe_snippet = _redact_sensitive_content(f_snippet or "No snippet available.")

    payload = {
        "title": f_title,
        "severity": f_sev_str,
        "cwe_id": f_cwe or "N/A",
        "cve_id": f_cve or "N/A",
        "file_path": f_file or "N/A",
        "line_number": str(f_line) if f_line else "N/A",
        "source": str(f_source),
        "description": safe_description,
        "code_snippet": safe_snippet[:2000],  # hard cap for token budget
        "frameworks": ", ".join(frameworks) if frameworks else "All",
        "controls_context": _build_controls_context(controls),
    }

    try:
        return _call_llm_for_compliance(payload)
    except Exception:
        logger.exception(
            "Compliance mapping failed for finding %s after all retries", f_id
        )
        # Return a degraded result — scan continues
        return ComplianceMappingResult(
            violations=[],
            cvss_score=0.0,
            cvss_vector="",
            remediation_steps=[f_remediation] if f_remediation else [],
            remediation_priority="long-term",
        )


def persist_violations(
    db_session: Any,  # sync Session for Celery worker
    finding_id: uuid.UUID,
    result: ComplianceMappingResult,
) -> None:
    """Persist ComplianceViolation rows (idempotent — skips duplicates)."""
    for v in result.violations:
        existing = db_session.query(ComplianceViolation).filter_by(
            finding_id=finding_id,
            framework=v.framework,
            control_id=v.control_id,
        ).first()
        if existing:
            continue
        violation = ComplianceViolation(
            id=uuid.uuid4(),
            finding_id=finding_id,
            framework=v.framework,
            control_id=v.control_id,
            control_title=v.control_title,
            violation_description=v.violation_description,
            evidence=_redact_sensitive_content(v.evidence),
            rag_chunk_ids=v.rag_chunk_ids,
        )
        db_session.add(violation)
    db_session.commit()
