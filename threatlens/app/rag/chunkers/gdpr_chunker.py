from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("Art.5", "Principles relating to processing", "process personal data lawfully, fairly, transparently, minimally, accurately, securely, and only for defined purposes", "Data processing principles", 0.85, "excessive collection retention purpose limitation integrity confidentiality PII logs"),
    Control("Art.25", "Data protection by design and by default", "embed privacy safeguards into system design and default settings throughout the processing lifecycle", "Privacy engineering", 0.9, "privacy by design insecure defaults excessive access data minimization"),
    Control("Art.32", "Security of processing", "protect personal data using risk-appropriate confidentiality, integrity, availability, encryption, resilience, testing, and access safeguards", "Technical and organizational measures", 1.0, "hardcoded password secret credential weak authentication encryption access control data breach Redis without authentication"),
    Control("Art.33", "Notification of a personal data breach", "detect, assess, document, and notify the supervisory authority of qualifying personal data breaches within required timelines", "Incident response", 0.95, "data breach incident detection notification 72 hours audit trail"),
    Control("Art.34", "Communication of a personal data breach", "notify affected people when a breach is likely to create a high risk to their rights and freedoms", "Breach communication", 0.9, "breach communication affected users high risk notification"),
    Control("Art.35", "Data protection impact assessment", "assess and reduce privacy risks before introducing processing likely to create high risk", "Risk assessment", 0.85, "DPIA high risk profiling surveillance sensitive data architecture review"),
    Control("Art.83", "General conditions for administrative fines", "evaluate infringement severity, duration, intent, mitigation, safeguards, and cooperation when determining penalties", "Enforcement", 0.8, "regulatory fine noncompliance repeated violation negligence"),
)


def chunk_gdpr() -> list[Chunk]:
    return build_control_chunks("GDPR", "2016/679", _CONTROLS)
