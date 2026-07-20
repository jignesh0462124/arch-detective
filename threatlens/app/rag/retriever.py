from __future__ import annotations

from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchAny

from app.config import settings
from app.rag.embedder import encode_text
from app.rag.qdrant_client import RAGStorageError, get_qdrant


_FRAMEWORK_ALIASES = {
    "GDPR": "GDPR",
    "SOC2": "SOC2",
    "SOC_2": "SOC2",
    "ISO27001": "ISO27001",
    "ISO_27001": "ISO27001",
    "PCI": "PCI_DSS",
    "PCI_DSS": "PCI_DSS",
    "NIST": "NIST_CSF",
    "NIST_CSF": "NIST_CSF",
    "OWASP": "OWASP",
    "NVD": "NVD",
}


def normalize_frameworks(frameworks: list[str] | None) -> list[str] | None:
    if frameworks is None:
        return None
    normalized: list[str] = []
    for framework in frameworks:
        key = framework.strip().upper().replace("-", "_").replace(" ", "_")
        value = _FRAMEWORK_ALIASES.get(key)
        if value is None:
            raise ValueError(f"Unsupported framework: {framework}")
        if value not in normalized:
            normalized.append(value)
    if not normalized:
        raise ValueError("frameworks cannot be empty")
    return normalized


def retrieve_relevant_controls(
    finding_text: str,
    frameworks: list[str] | None = None,
    top_k: int = 10,
) -> list[dict[str, Any]]:
    if not finding_text.strip():
        raise ValueError("finding_text cannot be blank")
    if not 1 <= top_k <= 50:
        raise ValueError("top_k must be between 1 and 50")

    normalized = normalize_frameworks(frameworks)
    query_filter = None
    if normalized:
        query_filter = Filter(
            must=[FieldCondition(key="framework", match=MatchAny(any=normalized))]
        )

    try:
        matches = get_qdrant().search(
            collection_name=settings.QDRANT_COLLECTION,
            query_vector=encode_text(finding_text),
            query_filter=query_filter,
            limit=min(top_k * 4, 200),
            with_payload=True,
        )
    except Exception as exc:
        raise RAGStorageError("Unable to retrieve compliance controls") from exc

    controls: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for match in matches:
        payload = match.payload or {}
        framework = str(payload.get("framework", ""))
        control_id = str(payload.get("control_id", ""))
        identity = (framework, control_id)
        if not framework or not control_id or identity in seen:
            continue
        seen.add(identity)
        controls.append(
            {
                "framework": framework,
                "control_id": control_id,
                "control_title": str(payload.get("control_title", "")),
                "text": str(payload.get("text", "")),
                "score": float(match.score),
                "category": str(payload.get("category", "")),
                "severity_weight": float(payload.get("severity_weight", 0.0)),
            }
        )
        if len(controls) == top_k:
            break
    return controls
