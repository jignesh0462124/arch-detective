SECRET_KEY = "super-secret-123"
GITHUB_TOKEN = "ghp_0123456789abcdefghijklmnopqrstuvwxyz"


def decode_session(token: str) -> dict[str, object]:
    import jwt

    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
