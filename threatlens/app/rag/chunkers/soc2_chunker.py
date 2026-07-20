from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("CC6.1", "Logical access security", "define and operate logical access safeguards for protected information assets", "Logical access", 1.0, "identity access management hardcoded credentials authentication authorization least privilege"),
    Control("CC6.2", "User registration and authorization", "authorize new users before provisioning credentials and system access", "Identity lifecycle", 0.9, "account provisioning approval orphan account"),
    Control("CC6.3", "Access modification and removal", "modify or revoke access promptly when responsibilities or employment change", "Identity lifecycle", 0.9, "termination deprovisioning stale privileges access review"),
    Control("CC6.4", "Physical access restriction", "restrict physical access to facilities and infrastructure containing protected assets", "Physical security", 0.75, "datacenter physical access badge visitor"),
    Control("CC6.5", "Secure disposal", "remove confidential information from assets before disposal or reuse", "Asset disposal", 0.75, "media sanitization deletion disposal backup"),
    Control("CC6.6", "Boundary protection", "protect systems from external threats using managed network and communication boundaries", "Network security", 0.95, "firewall public subnet 0.0.0.0 ingress segmentation exposed service"),
    Control("CC6.7", "Secure transmission", "protect information while it is transmitted or moved", "Data protection", 0.95, "TLS encryption in transit insecure protocol cookie secure flag"),
    Control("CC6.8", "Malicious software prevention", "prevent, detect, and remediate malicious or unauthorized software", "Endpoint security", 0.85, "malware executable dependency package antivirus"),
    Control("CC7.1", "Detection configuration", "configure systems to detect anomalies, vulnerabilities, and unauthorized changes", "Monitoring", 0.9, "monitoring vulnerability scan anomaly configuration drift"),
    Control("CC7.2", "Security event monitoring", "monitor system components and analyze events for signs of security incidents", "Monitoring", 0.95, "logging alert SIEM audit event detection"),
    Control("CC7.3", "Security event evaluation", "evaluate detected security events and determine whether they constitute incidents", "Incident response", 0.9, "triage incident classification escalation"),
    Control("CC7.4", "Incident response", "contain, investigate, remediate, and communicate identified security incidents", "Incident response", 0.95, "containment forensics breach remediation"),
    Control("CC7.5", "Recovery from incidents", "restore operations and improve safeguards after security incidents", "Recovery", 0.85, "recovery backup restoration lessons learned"),
    Control("CC8.1", "Change management", "authorize, test, approve, and track infrastructure, software, and data changes", "Change management", 0.85, "unreviewed deployment change approval CI CD rollback"),
    Control("CC9.1", "Risk mitigation", "identify and implement actions that reduce risks affecting system objectives", "Risk management", 0.85, "risk treatment remediation exception acceptance"),
    Control("CC9.2", "Vendor and business partner risk", "assess and manage security risks introduced by vendors and business partners", "Third-party risk", 0.8, "vendor SaaS supply chain processor contract"),
)


def chunk_soc2() -> list[Chunk]:
    return build_control_chunks("SOC2", "2017 TSC", _CONTROLS)
