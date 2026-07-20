from app.rag.chunkers.base import Chunk, Control, build_control_chunks


_CONTROLS = (
    Control("A01:2021", "Broken Access Control", "prevent users from acting outside their intended permissions", "Application security", 1.0, "authorization IDOR privilege escalation path traversal CORS"),
    Control("A02:2021", "Cryptographic Failures", "protect sensitive data using appropriate encryption, key management, and transport security", "Application security", 1.0, "plaintext weak cipher hardcoded key TLS password hashing"),
    Control("A03:2021", "Injection", "keep untrusted input from being interpreted as commands or queries", "Application security", 1.0, "SQL injection XSS command injection LDAP template"),
    Control("A04:2021", "Insecure Design", "apply threat modeling and secure design patterns before implementation", "Application security", 0.9, "missing control business logic threat model insecure workflow"),
    Control("A05:2021", "Security Misconfiguration", "establish secure configurations and remove unnecessary features, defaults, and exposure", "Application security", 0.95, "default password debug mode public bucket directory listing"),
    Control("A06:2021", "Vulnerable and Outdated Components", "inventory, monitor, patch, and replace vulnerable software components", "Application security", 0.95, "CVE dependency outdated package end of life"),
    Control("A07:2021", "Identification and Authentication Failures", "secure identity, authentication, password, session, and credential handling", "Application security", 1.0, "hardcoded password MFA session fixation credential stuffing JWT"),
    Control("A08:2021", "Software and Data Integrity Failures", "verify integrity and trust in software updates, dependencies, pipelines, and serialized data", "Application security", 0.95, "supply chain unsigned update deserialization CI CD"),
    Control("A09:2021", "Security Logging and Monitoring Failures", "produce actionable security logs and detect, escalate, and respond to attacks", "Application security", 0.9, "missing audit log SIEM alert incident detection"),
    Control("A10:2021", "Server-Side Request Forgery", "validate and constrain server-side requests to untrusted destinations", "Application security", 0.95, "SSRF metadata endpoint URL allowlist internal network"),
)


def chunk_owasp() -> list[Chunk]:
    return build_control_chunks("OWASP", "Top 10 2021", _CONTROLS)
