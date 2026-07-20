from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("A.5.1", "Policies for information security", "establish, approve, communicate, and regularly review information security policies", "Organizational", 0.75, "security policy governance review"),
    Control("A.5.2", "Information security roles", "define and assign information security responsibilities", "Organizational", 0.75, "ownership responsibility RACI"),
    Control("A.5.7", "Threat intelligence", "collect and analyze threat information to produce actionable intelligence", "Organizational", 0.8, "threat feed CVE exploit intelligence"),
    Control("A.5.9", "Inventory of information and assets", "maintain an accurate inventory with accountable owners", "Asset management", 0.8, "unknown asset shadow IT inventory owner"),
    Control("A.5.15", "Access control", "define and enforce rules for physical and logical access based on business and security requirements", "Access control", 0.95, "authorization least privilege RBAC public access"),
    Control("A.5.16", "Identity management", "manage identities through their complete lifecycle", "Access control", 0.9, "account lifecycle provisioning deprovisioning identity"),
    Control("A.5.17", "Authentication information", "allocate, protect, reset, and manage passwords, keys, tokens, and other authentication information", "Access control", 1.0, "hardcoded password secret credential JWT token API key plaintext"),
    Control("A.5.18", "Access rights", "provision, review, modify, and remove access rights according to authorization", "Access control", 0.95, "privileged access stale role entitlement review"),
    Control("A.5.23", "Cloud service security", "govern acquisition, use, management, and exit from cloud services", "Supplier and cloud", 0.85, "cloud AWS Azure SaaS shared responsibility"),
    Control("A.5.24", "Incident management planning", "prepare roles, processes, and communication for information security incidents", "Incident management", 0.85, "incident plan runbook escalation"),
    Control("A.5.25", "Assessment of security events", "assess security events consistently and decide whether they are incidents", "Incident management", 0.85, "event triage classification SIEM"),
    Control("A.5.26", "Response to security incidents", "respond to incidents using documented procedures", "Incident management", 0.95, "containment eradication forensics breach"),
    Control("A.5.30", "ICT readiness for continuity", "plan, implement, maintain, and test technology continuity capabilities", "Continuity", 0.85, "disaster recovery resilience failover backup"),
    Control("A.5.31", "Legal and contractual requirements", "identify and maintain applicable legal, regulatory, and contractual obligations", "Compliance", 0.8, "regulation contract statutory compliance"),
    Control("A.5.34", "Privacy and protection of PII", "protect personal information according to applicable privacy obligations", "Privacy", 0.95, "PII privacy personal data logging disclosure"),
    Control("A.6.3", "Security awareness and training", "provide role-appropriate security awareness, education, and training", "People", 0.7, "phishing training developer secure coding"),
    Control("A.7.4", "Physical security monitoring", "monitor premises for unauthorized physical access", "Physical", 0.7, "CCTV alarm visitor datacenter"),
    Control("A.8.2", "Privileged access rights", "restrict and manage privileged access through controlled authorization", "Technological", 1.0, "admin root privilege escalation service account"),
    Control("A.8.5", "Secure authentication", "implement secure authentication technologies and procedures appropriate to access restrictions", "Technological", 1.0, "hardcoded password credential MFA brute force weak authentication JWT secret"),
    Control("A.8.7", "Protection against malware", "implement controls to prevent and detect malware supported by user awareness", "Technological", 0.85, "malware ransomware malicious dependency"),
    Control("A.8.8", "Management of technical vulnerabilities", "identify, assess, prioritize, and remediate technical vulnerabilities", "Technological", 0.95, "CVE patch outdated dependency vulnerability scan"),
    Control("A.8.9", "Configuration management", "establish, document, implement, monitor, and review secure configurations", "Technological", 0.9, "misconfiguration insecure default infrastructure as code"),
    Control("A.8.12", "Data leakage prevention", "detect and prevent unauthorized disclosure or extraction of sensitive information", "Technological", 0.95, "data exfiltration PII logs public bucket secret"),
    Control("A.8.13", "Information backup", "maintain and test backups according to recovery requirements", "Technological", 0.85, "backup restore ransomware recovery"),
    Control("A.8.15", "Logging", "produce, protect, retain, and analyze logs of relevant activities and events", "Technological", 0.9, "audit log tampering missing logs SIEM"),
    Control("A.8.16", "Monitoring activities", "monitor networks, systems, and applications for anomalous behavior", "Technological", 0.9, "alert anomaly detection telemetry"),
    Control("A.8.20", "Network security", "secure and manage networks and network devices", "Technological", 0.95, "firewall ingress exposed port segmentation"),
    Control("A.8.24", "Use of cryptography", "define and apply rules for effective cryptography and key management", "Technological", 1.0, "weak cipher plaintext encryption key rotation TLS"),
    Control("A.8.25", "Secure development lifecycle", "integrate security activities throughout software and system development", "Technological", 0.9, "SDLC code review SAST threat model CI"),
    Control("A.8.28", "Secure coding", "apply secure coding principles to software development", "Technological", 0.95, "SQL injection XSS command injection unsafe deserialization"),
)


def chunk_iso27001() -> list[Chunk]:
    return build_control_chunks("ISO27001", "2022", _CONTROLS)
