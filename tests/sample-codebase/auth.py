"""
Insecure authentication module.
WARNING: Intentionally vulnerable for ThreatLens scanner testing.
"""
import base64
import time


# CWE-798: Hardcoded JWT secret
JWT_SECRET = "jwt_secret_do_not_share"

# CWE-312: Cleartext storage of sensitive information
USER_DB = {
    "admin": "admin123",
    "jignesh": "password1",
    "test": "test123",
}


def verify_password(username: str, password: str) -> bool:
    """CWE-287: Improper authentication — timing attack possible."""
    stored = USER_DB.get(username, "")
    # Direct string compare leaks timing info
    return stored == password


def create_token(user_id: str) -> str:
    """CWE-347: Algorithm confusion — accepts alg=none."""
    # Fake JWT with no signature verification
    header = base64.b64encode(b'{"alg":"none","typ":"JWT"}').decode()
    payload = base64.b64encode(
        f'{{"sub":"{user_id}","iat":{int(time.time())}}}'.encode()
    ).decode()
    # No signature — alg:none accepted
    return f"{header}.{payload}."


def verify_token(token: str) -> dict | None:
    """Accepts unsigned tokens — no signature check."""
    try:
        parts = token.split(".")
        payload = base64.b64decode(parts[1] + "==")
        import json
        return json.loads(payload)
    except Exception:
        return None


def reset_password(email: str) -> str:
    """CWE-640: Weak password reset — predictable token."""
    # Reset token is just the email base64 encoded — trivially predictable
    token = base64.b64encode(email.encode()).decode()
    return f"http://app.example.com/reset?token={token}"


def log_login_attempt(username: str, password: str) -> None:
    """CWE-532: Sensitive data in log — logs plaintext password."""
    print(f"[AUTH] Login attempt: username={username} password={password}")
