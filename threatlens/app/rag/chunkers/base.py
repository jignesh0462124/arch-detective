from __future__ import annotations

from dataclasses import dataclass
from typing import Any


Chunk = dict[str, Any]


@dataclass(frozen=True, slots=True)
class Control:
    control_id: str
    title: str
    summary: str
    category: str
    severity_weight: float
    keywords: str = ""


_FACETS = (
    (
        "control_intent",
        "Control intent",
        "The control objective is to {summary}",
    ),
    (
        "implementation_guidance",
        "Implementation guidance",
        "Implement documented ownership, preventive safeguards, automated checks, and exception handling to {summary}",
    ),
    (
        "audit_evidence",
        "Audit evidence",
        "Relevant evidence includes approved policies, configuration exports, access records, monitoring events, test results, and remediation tickets demonstrating that teams {summary}",
    ),
    (
        "threat_mapping",
        "Threat mapping",
        "Map findings involving {keywords} to this control when the observed weakness prevents the organization from ensuring it can {summary}",
    ),
)


def build_control_chunks(
    framework: str,
    version: str,
    controls: tuple[Control, ...],
) -> list[Chunk]:
    chunks: list[Chunk] = []
    for control in controls:
        keywords = control.keywords or control.title
        for facet_id, facet_title, template in _FACETS:
            facet_text = template.format(summary=control.summary, keywords=keywords)
            chunks.append(
                {
                    "text": (
                        f"{control.control_id} - {control.title}\n\n"
                        f"{facet_title}: {facet_text}.\n"
                        f"Security signals: {keywords}."
                    ),
                    "metadata": {
                        "framework": framework,
                        "version": version,
                        "control_id": control.control_id,
                        "control_title": control.title,
                        "category": control.category,
                        "severity_weight": control.severity_weight,
                        "chunk_type": facet_id,
                    },
                }
            )
    return chunks
