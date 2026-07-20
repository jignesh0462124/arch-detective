from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("GV.OC-01", "Organizational mission", "understand how the organizational mission informs cybersecurity risk management", "Govern", 0.65, "business mission security objectives"),
    Control("GV.OC-03", "Legal and regulatory requirements", "understand and manage legal, regulatory, and contractual cybersecurity requirements", "Govern", 0.8, "regulation contract compliance obligation"),
    Control("GV.RM-01", "Risk management objectives", "establish and communicate cybersecurity risk management objectives", "Govern", 0.75, "risk appetite objective governance"),
    Control("GV.RM-05", "Risk communication", "establish lines of communication for cybersecurity risks across the organization", "Govern", 0.7, "risk reporting escalation stakeholders"),
    Control("GV.RR-02", "Roles and responsibilities", "define, communicate, and enforce cybersecurity roles and responsibilities", "Govern", 0.75, "ownership RACI accountability"),
    Control("GV.SC-05", "Supply chain requirements", "establish cybersecurity requirements for suppliers and third parties", "Govern", 0.8, "vendor supplier SaaS supply chain"),
    Control("ID.AM-01", "Hardware inventory", "maintain an inventory of organization-managed hardware", "Identify", 0.7, "asset inventory device server"),
    Control("ID.AM-02", "Software inventory", "maintain an inventory of software, services, and systems", "Identify", 0.8, "SBOM package dependency shadow IT"),
    Control("ID.AM-03", "Network communication inventory", "maintain representations of authorized network communications and data flows", "Identify", 0.8, "network diagram data flow port service"),
    Control("ID.AM-05", "Asset prioritization", "prioritize assets based on classification, criticality, resources, and mission impact", "Identify", 0.75, "critical asset crown jewel classification"),
    Control("ID.RA-01", "Vulnerability identification", "identify, validate, record, and manage vulnerabilities in assets", "Identify", 0.95, "CVE vulnerability scan SAST patch"),
    Control("ID.RA-03", "Threat identification", "identify and record internal and external cyber threats", "Identify", 0.8, "threat intelligence attacker insider"),
    Control("ID.RA-05", "Risk understanding", "understand likelihood and impact to prioritize inherent cybersecurity risk", "Identify", 0.8, "risk score likelihood impact CVSS"),
    Control("ID.IM-01", "Security improvement", "identify improvements from evaluations and operational security processes", "Identify", 0.7, "lessons learned audit finding improvement"),
    Control("PR.AA-01", "Identity management", "manage identities and credentials for authorized users, services, and devices", "Protect", 0.95, "identity credential service account API key"),
    Control("PR.AA-03", "Authentication", "authenticate users, services, and devices using context-appropriate strength", "Protect", 1.0, "hardcoded password weak authentication MFA token JWT secret"),
    Control("PR.AA-05", "Access permissions", "define, manage, enforce, and review access permissions using least privilege", "Protect", 1.0, "authorization RBAC admin privilege escalation"),
    Control("PR.AT-01", "Security awareness", "provide personnel with cybersecurity awareness and training", "Protect", 0.65, "phishing training awareness"),
    Control("PR.DS-01", "Data at rest protection", "protect the confidentiality, integrity, and availability of data at rest", "Protect", 1.0, "unencrypted database bucket disk plaintext data at rest"),
    Control("PR.DS-02", "Data in transit protection", "protect the confidentiality, integrity, and availability of data in transit", "Protect", 1.0, "TLS plaintext HTTP weak cipher certificate"),
    Control("PR.DS-10", "Data in use protection", "protect sensitive information while it is actively processed", "Protect", 0.9, "memory secret exposure confidential computing"),
    Control("PR.PS-01", "Configuration management", "establish and apply secure configuration management practices", "Protect", 0.9, "misconfiguration insecure default IaC baseline"),
    Control("PR.PS-02", "Software maintenance", "maintain, replace, and remove software according to risk", "Protect", 0.85, "end of life outdated software patch"),
    Control("PR.PS-05", "Unauthorized software prevention", "prevent installation and execution of unauthorized software", "Protect", 0.85, "allowlist malicious binary package"),
    Control("PR.IR-01", "Network resilience", "protect networks and environments from unauthorized logical access and usage", "Protect", 0.95, "firewall segmentation 0.0.0.0 exposed port"),
    Control("PR.IR-03", "Resilience mechanisms", "implement mechanisms that achieve resilience requirements in normal and adverse conditions", "Protect", 0.85, "redundancy failover availability DDoS"),
    Control("DE.CM-01", "Network monitoring", "monitor networks and network services for potentially adverse events", "Detect", 0.9, "IDS traffic anomaly network alert"),
    Control("DE.CM-03", "Personnel activity monitoring", "monitor personnel activity and technology usage for adverse events", "Detect", 0.8, "insider privileged activity audit"),
    Control("DE.CM-06", "External service monitoring", "monitor external service provider activities for adverse events", "Detect", 0.8, "vendor SaaS provider telemetry"),
    Control("DE.CM-09", "Technology monitoring", "monitor computing hardware, software, runtime environments, and data for adverse events", "Detect", 0.9, "EDR runtime workload anomaly"),
    Control("DE.AE-02", "Event analysis", "analyze potentially adverse events to understand associated activity", "Detect", 0.85, "SIEM correlation triage alert"),
    Control("DE.AE-06", "Event communication", "provide information about adverse events to authorized staff and tools", "Detect", 0.75, "notification escalation SOC alert"),
    Control("RS.MA-01", "Incident response execution", "execute the incident response plan in coordination with relevant parties", "Respond", 0.95, "incident containment breach response runbook"),
    Control("RS.AN-03", "Root cause analysis", "determine what occurred and establish the root cause of an incident", "Respond", 0.85, "forensics timeline root cause"),
    Control("RS.CO-02", "Incident notification", "notify internal and external stakeholders of incidents", "Respond", 0.85, "breach notification regulator customer"),
    Control("RS.MI-01", "Incident containment", "contain incidents to prevent expansion and additional harm", "Respond", 0.95, "isolate revoke block containment"),
    Control("RS.MI-02", "Incident eradication", "eradicate incident causes and artifacts", "Respond", 0.9, "remove malware patch compromise"),
    Control("RC.RP-01", "Recovery plan execution", "execute the recovery portion of the incident response plan", "Recover", 0.9, "restore disaster recovery continuity"),
    Control("RC.CO-03", "Recovery communication", "communicate recovery activities to designated stakeholders", "Recover", 0.75, "status communication recovery stakeholder"),
    Control("RC.IM-01", "Recovery improvement", "identify improvements from recovery evaluations and lessons learned", "Recover", 0.75, "post incident review lessons learned resilience"),
)


def chunk_nist() -> list[Chunk]:
    return build_control_chunks("NIST_CSF", "2.0", _CONTROLS)
