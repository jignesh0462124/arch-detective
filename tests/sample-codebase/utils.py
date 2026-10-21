"""
Insecure utility functions.
WARNING: Intentionally vulnerable for ThreatLens scanner testing.
"""
import os
import urllib.request
import xml.etree.ElementTree as ET


def read_user_file(filename: str) -> str:
    """CWE-22: Path traversal — no sanitisation of filename input."""
    base_dir = "/app/uploads"
    # Attacker can pass: ../../etc/passwd
    file_path = os.path.join(base_dir, filename)
    with open(file_path, "r") as f:
        return f.read()


def fetch_url(url: str) -> str:
    """CWE-918: Server-Side Request Forgery (SSRF).
    Attacker can pass internal URLs: http://169.254.169.254/latest/meta-data/
    """
    response = urllib.request.urlopen(url)
    return response.read().decode()


def parse_xml_data(xml_string: str) -> dict:
    """CWE-611: XML External Entity (XXE) injection.
    No defences against XXE — allows reading local files via entity references.
    """
    # Vulnerable: resolve_entities not disabled
    root = ET.fromstring(xml_string)
    return {child.tag: child.text for child in root}


def render_template(template: str, **kwargs) -> str:
    """CWE-94: Code injection via unsafe string formatting."""
    # Using % formatting with user data — allows format string attacks
    return template % kwargs


def deserialize_user_data(data: bytes) -> object:
    """CWE-502: Insecure deserialization."""
    import pickle
    # pickle.loads with untrusted data allows arbitrary code execution
    return pickle.loads(data)


def hash_token(token: str) -> str:
    """CWE-328: Weak hash — SHA1 for security-sensitive token."""
    import hashlib
    return hashlib.sha1(token.encode()).hexdigest()


def get_user_avatar(user_id: str) -> bytes:
    """CWE-918: SSRF via user-controlled URL parameter."""
    avatar_url = f"http://internal-service/avatars/{user_id}"
    with urllib.request.urlopen(avatar_url) as resp:
        return resp.read()
