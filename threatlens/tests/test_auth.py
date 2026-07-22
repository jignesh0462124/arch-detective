from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth.jwt_verifier import AuthTokenError, SupabaseJWTVerifier
from app.main import app


def test_claims_convert_to_authenticated_user() -> None:
    user = SupabaseJWTVerifier._to_user(
        {
            "sub": "10000000-0000-0000-0000-000000000001",
            "email": "analyst@example.com",
            "session_id": "session-1",
        },
    )

    assert user.id == UUID("10000000-0000-0000-0000-000000000001")
    assert str(user.email) == "analyst@example.com"


def test_claims_reject_non_uuid_subject() -> None:
    with pytest.raises((AuthTokenError, ValidationError)):
        SupabaseJWTVerifier._to_user({"sub": "not-a-uuid"})


def test_auth_me_requires_bearer_token() -> None:
    response = TestClient(app).get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
