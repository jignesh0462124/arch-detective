from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from jwt import PyJWKClientConnectionError

from app.auth.jwt_verifier import AuthTokenError, AuthVerificationUnavailable, SupabaseJWTVerifier
from app.config import settings
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


def test_signing_key_outage_is_temporary_not_expired(monkeypatch) -> None:
    class UnavailableVerifier:
        async def verify(self, token):
            raise AuthVerificationUnavailable("Signing keys are temporarily unavailable")
    # get_current_user calls its cached verifier directly, not via dependency injection.
    from app.auth import dependencies
    monkeypatch.setattr(dependencies, 'get_jwt_verifier', lambda: UnavailableVerifier())
    response = TestClient(app).get('/api/v1/auth/me', headers={'Authorization': 'Bearer test-token'})
    assert response.status_code == 503
    assert 'temporarily unavailable' in response.json()['detail']


@pytest.mark.asyncio
async def test_jwks_connection_failure_is_not_an_invalid_token() -> None:
    class UnavailableKeys:
        def get_signing_key_from_jwt(self, token):
            raise PyJWKClientConnectionError("network unavailable")
    verifier = object.__new__(SupabaseJWTVerifier)
    verifier._jwks_client = UnavailableKeys()
    verifier._settings = settings
    with pytest.raises(AuthVerificationUnavailable):
        await verifier.verify("syntactically-valid-token")
