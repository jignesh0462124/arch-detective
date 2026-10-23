from uuid import UUID
import asyncio
import time
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from pydantic import ValidationError
from jwt import PyJWKClientConnectionError

from app.auth.jwt_verifier import AuthAccessDenied, AuthTokenError, AuthVerificationUnavailable, SupabaseJWTVerifier
from app.config import Settings
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
    verifier = SupabaseJWTVerifier(auth_config())
    verifier._jwks_client = UnavailableKeys()
    with pytest.raises(AuthVerificationUnavailable):
        await verifier.verify(access_token()[0])


def auth_config(**overrides):
    return Settings(_env_file=None, SUPABASE_URL="https://project.example",
                    SUPABASE_JWT_ISSUER="https://project.example/auth/v1",
                    SUPABASE_JWKS_URL="https://project.example/auth/v1/.well-known/jwks.json",
                    SUPABASE_PUBLISHABLE_KEY="sb_publishable_fixture", **overrides)


def access_token(algorithm="ES256", **overrides):
    now = int(time.time())
    claims = {"sub":"10000000-0000-0000-0000-000000000001", "email":"analyst@example.com",
              "aud":"authenticated", "iss":"https://project.example/auth/v1", "iat":now, "exp":now+3600,
              **overrides}
    key = ec.generate_private_key(ec.SECP256R1()) if algorithm == "ES256" else "fixture-only-secret-not-a-configured-signing-key"
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid":"fixture-key"}), key


def key_fixture(monkeypatch, verifier, key):
    monkeypatch.setattr(verifier, "_signing_key", lambda _: SimpleNamespace(key=key.public_key()))


@pytest.mark.asyncio
async def test_valid_asymmetric_signature_does_not_call_auth(monkeypatch):
    token, key = access_token()
    verifier = SupabaseJWTVerifier(auth_config())
    key_fixture(monkeypatch, verifier, key)
    async def forbidden(*args):
        raise AssertionError("Local verification must not call Auth for every request")
    monkeypatch.setattr(verifier, "_validate_remote", forbidden)
    assert str((await verifier.verify(token)).id).endswith("0001")


@pytest.mark.asyncio
@pytest.mark.parametrize("time_claims", [{"iat":int(time.time())+137}, {"exp":int(time.time())-137}])
async def test_clock_mismatch_requires_remote_proof_not_leeway(monkeypatch, time_claims):
    token,key = access_token(**time_claims)
    verifier=SupabaseJWTVerifier(auth_config())
    key_fixture(monkeypatch,verifier,key)
    called=[]
    async def proven(received, claims):
        called.append(received)
    monkeypatch.setattr(verifier,"_validate_remote",proven)
    await verifier.verify(token)
    assert called==[token]
    async def invalid(*args):
        raise AuthTokenError("Invalid or expired access token")
    monkeypatch.setattr(verifier,"_validate_remote",invalid)
    with pytest.raises(AuthTokenError):
        await verifier.verify(token)


@pytest.mark.asyncio
@pytest.mark.parametrize("claims", [{"iss":"https://outsider.example/auth/v1"}, {"aud":"service_role"}, {"sub":"bad"}, {"exp":True}])
async def test_invalid_claims_never_reach_remote_fallback(monkeypatch, claims):
    token,key=access_token(iat=int(time.time())+137,**claims)
    verifier=SupabaseJWTVerifier(auth_config())
    key_fixture(monkeypatch,verifier,key)
    async def forbidden(*args):
        raise AssertionError("Wrong-project or malformed claims cannot reach Auth fallback")
    monkeypatch.setattr(verifier,"_validate_remote",forbidden)
    with pytest.raises(AuthTokenError):
        await verifier.verify(token)


@pytest.mark.asyncio
async def test_invalid_signature_is_not_rescued_by_auth(monkeypatch):
    token,_=access_token(iat=int(time.time())+137)
    verifier=SupabaseJWTVerifier(auth_config())
    key_fixture(monkeypatch,verifier,ec.generate_private_key(ec.SECP256R1()))
    async def forbidden(*args):
        raise AssertionError("Invalid signature must fail locally")
    monkeypatch.setattr(verifier,"_validate_remote",forbidden)
    with pytest.raises(AuthTokenError):
        await verifier.verify(token)


@pytest.mark.asyncio
async def test_legacy_hs256_uses_fixed_project_auth_and_deduplicates(monkeypatch):
    token,_=access_token("HS256")
    verifier=SupabaseJWTVerifier(auth_config())
    calls=[]
    release=asyncio.Event()
    async def proven(received,claims):
        calls.append(received)
        await release.wait()
    monkeypatch.setattr(verifier,"_request_user",proven)
    tasks=[asyncio.create_task(verifier.verify(token)) for _ in range(8)]
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    release.set()
    assert len(await asyncio.gather(*tasks))==8
    assert calls==[token]
    await asyncio.sleep(0)
    assert not verifier._remote_checks


@pytest.mark.asyncio
@pytest.mark.parametrize("status,body,error", [
    (401,{"msg":"invalid JWT"},AuthTokenError),
    (401,{"message":"Invalid API key"},AuthVerificationUnavailable),
    (403,{"message":"account denied"},AuthAccessDenied),
    (429,{},AuthVerificationUnavailable),(503,{},AuthVerificationUnavailable),
    (200,{"id":"10000000-0000-0000-0000-000000000002"},AuthTokenError),
    (200,[],AuthVerificationUnavailable),
])
async def test_auth_response_categories_and_trusted_destination(monkeypatch,status,body,error):
    from app.storage import workbench_store
    verifier=SupabaseJWTVerifier(auth_config())
    token,_=access_token("HS256")
    def respond(request):
        assert str(request.url)=="https://project.example/auth/v1/user"
        assert request.headers["apikey"]=="sb_publishable_fixture"
        assert request.headers["authorization"]=="Bearer "+token
        return httpx.Response(status,json=body)
    @asynccontextmanager
    async def connection():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            yield client
    monkeypatch.setattr(workbench_store,"connection",connection)
    with pytest.raises(error):
        await verifier.verify(token)


@pytest.mark.asyncio
async def test_missing_public_key_is_configuration_failure():
    config=auth_config()
    config.SUPABASE_PUBLISHABLE_KEY=""
    with pytest.raises(AuthVerificationUnavailable):
        await SupabaseJWTVerifier(config).verify(access_token("HS256")[0])


@pytest.mark.asyncio
@pytest.mark.parametrize("public_key", ["sb_secret_fixture", jwt.encode({"role":"service_role"},"fixture-key-that-is-not-allowed-here",algorithm="HS256")])
async def test_secret_or_service_role_key_is_never_used_for_auth_validation(public_key):
    config=auth_config()
    config.SUPABASE_PUBLISHABLE_KEY=public_key
    with pytest.raises(AuthVerificationUnavailable):
        await SupabaseJWTVerifier(config).verify(access_token("HS256")[0])


def test_unknown_kid_refreshes_once_and_cache_is_bounded(monkeypatch):
    verifier=SupabaseJWTVerifier(auth_config())
    old=ec.generate_private_key(ec.SECP256R1())
    new=ec.generate_private_key(ec.SECP256R1())
    def jwk(key,kid):
        return {**jwt.algorithms.ECAlgorithm.to_jwk(key.public_key(),as_dict=True),"kid":kid,"use":"sig"}
    current={"keys":[jwk(old,"old")]}
    calls=[]
    def fetch():
        calls.append(True)
        verifier._jwks_client.jwk_set_cache.put(current)
        return current
    monkeypatch.setattr(verifier._jwks_client,"fetch_data",fetch)
    verifier._jwks_client.get_signing_key("old")
    current={"keys":[jwk(new,"new")]}
    verifier._jwks_client.get_signing_key("new")
    assert len(calls)==2
    verifier._jwks_client.get_signing_key("new")
    assert len(calls)==2
    with pytest.raises(jwt.PyJWKClientError):
        verifier._jwks_client.get_signing_key("missing")
    assert len(calls)==3
    assert verifier._jwks_client.jwk_set_cache.lifespan==300


def test_denied_account_is_403_not_false_session_expiry(monkeypatch):
    from app.auth import dependencies
    class DeniedVerifier:
        async def verify(self,token):
            raise AuthAccessDenied("Access denied")
    monkeypatch.setattr(dependencies,"get_jwt_verifier",lambda:DeniedVerifier())
    assert TestClient(app).get("/api/v1/ai/capabilities",headers={"Authorization":"Bearer fixture"}).status_code==403


@pytest.mark.asyncio
async def test_malformed_jwks_is_a_service_error_not_invalid_credentials():
    verifier=SupabaseJWTVerifier(auth_config())
    class MalformedKeys:
        def get_signing_key_from_jwt(self,token):
            raise ValueError("Invalid JSON from key service")
    verifier._jwks_client=MalformedKeys()
    with pytest.raises(AuthVerificationUnavailable):
        await verifier.verify(access_token()[0])


@pytest.mark.asyncio
async def test_confirmed_skew_never_extends_later_token_validity(monkeypatch):
    verifier=SupabaseJWTVerifier(auth_config())
    token,key=access_token(iat=int(time.time())+137)
    key_fixture(monkeypatch,verifier,key)
    async def confirmed(*args):
        return None
    monkeypatch.setattr(verifier,"_validate_remote",confirmed)
    await verifier.verify(token)
    assert verifier._remote_time_validation
    locally_valid,key=access_token()
    key_fixture(monkeypatch,verifier,key)
    async def rejected_by_auth(*args):
        raise AuthTokenError("Expired according to the authoritative Auth clock")
    monkeypatch.setattr(verifier,"_validate_remote",rejected_by_auth)
    with pytest.raises(AuthTokenError):
        await verifier.verify(locally_valid)
