from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("Req.1.2.1", "Network security control configuration", "define and implement network security control rules that restrict traffic to authorized business flows", "Network security", 0.95, "firewall any any 0.0.0.0 exposed database ingress egress"),
    Control("Req.1.3.1", "Trusted and untrusted network boundaries", "restrict inbound traffic from untrusted networks to systems authorized to receive it", "Network security", 1.0, "internet exposed port public subnet perimeter firewall"),
    Control("Req.2.2.1", "Secure configuration standards", "develop and apply secure configuration standards to all system components", "Secure configuration", 0.9, "default configuration unnecessary service insecure setting"),
    Control("Req.2.2.7", "Encrypted non-console administration", "encrypt administrative access using strong cryptography", "Secure configuration", 0.95, "Telnet HTTP admin cleartext SSH TLS"),
    Control("Req.3.3.1", "Stored account data", "limit storage and display of sensitive account data to the minimum required", "Account data protection", 1.0, "cardholder data PAN logs database retention"),
    Control("Req.3.5.1", "Protection of stored account data", "render primary account numbers unreadable wherever stored", "Account data protection", 1.0, "unencrypted database plaintext PAN encryption at rest"),
    Control("Req.3.6.1", "Cryptographic key management", "protect cryptographic keys against disclosure, misuse, and unauthorized substitution", "Key management", 1.0, "hardcoded encryption key KMS rotation plaintext key"),
    Control("Req.4.2.1", "Strong cryptography in transit", "protect account data with strong cryptography over open or public networks", "Transmission security", 1.0, "TLS 1.0 weak cipher plaintext transport certificate"),
    Control("Req.5.2.1", "Anti-malware mechanisms", "deploy and maintain mechanisms that detect, block, or contain malware", "Malware protection", 0.85, "malware ransomware malicious package endpoint"),
    Control("Req.6.2.1", "Secure software development", "develop software securely using defined processes and trained personnel", "Secure development", 0.85, "secure SDLC code review training"),
    Control("Req.6.3.2", "Software vulnerability inventory", "maintain an inventory of software and components to support vulnerability management", "Vulnerability management", 0.85, "SBOM dependency package version CVE"),
    Control("Req.6.3.3", "Security patching", "install critical and high security patches within risk-based timelines", "Vulnerability management", 0.95, "outdated dependency missing patch CVE"),
    Control("Req.6.4.2", "Public-facing web application protection", "continuously detect and prevent web application attacks", "Application security", 1.0, "SQL injection XSS WAF command injection public API"),
    Control("Req.6.5.1", "Change control", "document, authorize, test, and validate changes before production deployment", "Change management", 0.8, "unapproved deployment production change rollback"),
    Control("Req.7.2.1", "Access control model", "restrict access to system components and data according to business need", "Access control", 0.95, "least privilege authorization RBAC excessive access"),
    Control("Req.7.2.5", "Review of user access", "review user accounts and access privileges at defined intervals", "Access control", 0.85, "stale account access review entitlement"),
    Control("Req.8.2.1", "Unique user identification", "assign a unique identity before allowing access to system components or account data", "Identity", 0.9, "shared account generic user attribution"),
    Control("Req.8.3.1", "Strong authentication", "authenticate users and administrators using secure factors before granting access", "Authentication", 1.0, "weak password credential authentication brute force"),
    Control("Req.8.3.2", "Cryptographic protection of authentication factors", "protect passwords, tokens, and other authentication factors with strong cryptography during transmission and storage", "Authentication", 1.0, "hardcoded password plaintext credential JWT secret token hashing encryption"),
    Control("Req.8.4.2", "Multi-factor authentication", "require multi-factor authentication for access into the cardholder data environment", "Authentication", 1.0, "missing MFA privileged admin remote access"),
    Control("Req.10.2.1", "Audit logging", "enable audit logs that reconstruct user and administrative activity", "Logging", 0.9, "missing log audit event administrator activity"),
    Control("Req.10.4.1", "Review of security events", "review logs and security events to identify anomalies and suspicious activity", "Monitoring", 0.9, "SIEM alert log review anomaly"),
    Control("Req.11.3.1", "Internal vulnerability scans", "perform, remediate, and repeat internal vulnerability scans at required intervals", "Security testing", 0.9, "vulnerability scan CVE remediation rescan"),
    Control("Req.12.10.1", "Incident response plan", "maintain and test an incident response plan for account data incidents", "Governance", 0.9, "breach response forensics notification tabletop"),
)


def chunk_pci() -> list[Chunk]:
    return build_control_chunks("PCI_DSS", "4.0.1", _CONTROLS)
