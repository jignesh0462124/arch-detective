import asyncio
import hashlib
import threading
from collections.abc import Mapping
from uuid import UUID

import httpx
import jwt
from jwt import (
    ExpiredSignatureError,
    ImmatureSignatureError,
    InvalidTokenError,
    PyJWKClient,
    PyJWKClientConnectionError,
    PyJWKClientError,
)
from pydantic import ValidationError

from app.config import Settings, settings
from app.schemas.auth import AuthenticatedUser


class AuthTokenError(ValueError):
    pass


class AuthVerificationUnavailable(RuntimeError):
    pass


class AuthAccessDenied(RuntimeError):
    pass


class SupabaseJWTVerifier:
    def __init__(self, config: Settings = settings) -> None:
        if not config.SUPABASE_JWKS_URL:
            raise RuntimeError("SUPABASE_JWKS_URL is not configured")

        self._settings = config
        self._jwks_lock = threading.Lock()
        self._remote_checks: dict[tuple[int, str], asyncio.Task] = {}
        self._remote_time_validation = False
        self._jwks_client = PyJWKClient(
            config.SUPABASE_JWKS_URL,
            # Per-key LRU caching ignores JWKS expiry and can retain revoked keys.
            cache_keys=False,
            lifespan=300,
            timeout=5,
        )

    def _signing_key(self, token):
        with self._jwks_lock:
            # PyJWKClient refreshes once if the cached set has no matching kid.
            try:
                return self._jwks_client.get_signing_key_from_jwt(token)
            except (ValueError, TypeError) as exc:
                raise AuthVerificationUnavailable("Signing keys returned an invalid response") from exc

    async def verify(self, token: str) -> AuthenticatedUser:
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
            if algorithm == "HS256":
                # Decoding here only rejects wrong-project/malformed claims. Identity
                # is not accepted until the configured Auth server verifies the JWT.
                claims = self._decode(
                    token, None, algorithm, verify_signature=False, verify_time=False,
                )
                await self._validate_remote(token, claims)
            elif algorithm in self._settings.SUPABASE_JWT_ALGORITHMS and algorithm in {"ES256", "RS256"}:
                signing_key = await asyncio.to_thread(self._signing_key, token)
                try:
                    claims = self._decode(token, signing_key.key, algorithm)
                except (ImmatureSignatureError, ExpiredSignatureError):
                    # Keep signature/issuer/audience validation strict. The Auth
                    # server, not an arbitrary leeway, decides validity on its clock.
                    claims = self._decode(token, signing_key.key, algorithm, verify_time=False)
                    await self._validate_remote(token, claims)
                    # Once skew is proven, the slow/fast local clock must not
                    # extend later tokens' lifetimes. Keep Auth authoritative
                    # until the clock is corrected and this verifier restarts.
                    self._remote_time_validation = True
                else:
                    if self._remote_time_validation:
                        await self._validate_remote(token, claims)
            else:
                raise AuthTokenError("Unsupported access token algorithm")
        except PyJWKClientConnectionError as exc:
            raise AuthVerificationUnavailable("Signing keys are temporarily unavailable") from exc
        except PyJWKClientError as exc:
            if "Unable to find a signing key that matches" in str(exc):
                raise AuthTokenError("Access token signing key is not recognized") from exc
            raise AuthVerificationUnavailable("Signing keys are temporarily unavailable") from exc
        except (InvalidTokenError, ValueError) as exc:
            raise AuthTokenError("Invalid or expired access token") from exc

        try:
            return self._to_user(claims)
        except ValidationError as exc:
            raise AuthTokenError("Access token contains invalid user claims") from exc

    def _decode(self, token, key, algorithm, *, verify_signature=True, verify_time=True):
        claims = jwt.decode(
            token, key, algorithms=[algorithm],
            audience=self._settings.SUPABASE_JWT_AUDIENCE,
            issuer=self._settings.SUPABASE_JWT_ISSUER,
            options={
                "require": ["exp", "iat", "sub"],
                "verify_signature": verify_signature,
                "verify_iss": True,
                "verify_aud": True,
                "verify_exp": verify_time,
                "verify_iat": verify_time,
                "verify_nbf": verify_time,
            },
        )
        self._to_user(claims)
        times = [claims.get("exp"), claims.get("iat")]
        if "nbf" in claims:
            times.append(claims["nbf"])
        if any(not isinstance(value, int) or isinstance(value, bool) for value in times):
            raise AuthTokenError("Access token has invalid time claims")
        return claims

    async def _validate_remote(self, token, claims):
        key = (id(asyncio.get_running_loop()), hashlib.sha256(token.encode()).hexdigest())
        task = self._remote_checks.get(key)
        if task is None:
            if len(self._remote_checks) >= 64:
                raise AuthVerificationUnavailable("Authentication verification is busy")
            task = asyncio.create_task(self._request_user(token, claims))
            self._remote_checks[key] = task

            def done(completed):
                self._remote_checks.pop(key, None)
                if not completed.cancelled():
                    completed.exception()  # Observe errors if every waiting request was cancelled.
            task.add_done_callback(done)
        await asyncio.shield(task)

    async def _request_user(self, token, claims):
        from app.storage.workbench_store import connection

        public_key = self._settings.SUPABASE_PUBLISHABLE_KEY.strip()
        if not self._settings.SUPABASE_URL or not public_key:
            raise AuthVerificationUnavailable("Auth validation requires a configured publishable key")
        if not public_key.startswith("sb_publishable_"):
            # Support the legacy anon gateway key, but reject accidental secret or
            # service-role configuration. These claims only classify a fixed key;
            # they never grant the request's user any identity or permissions.
            try:
                legacy_public = jwt.decode(public_key, options={"verify_signature": False}).get("role") == "anon"
            except InvalidTokenError:
                legacy_public = False
            if not legacy_public:
                raise AuthVerificationUnavailable("Auth validation requires a public project key")
        try:
            async with connection() as client:
                response = await client.get(
                    self._settings.SUPABASE_URL.rstrip("/") + "/auth/v1/user",
                    headers={"apikey": public_key, "Authorization": "Bearer " + token},
                    timeout=5,
                )
        except httpx.HTTPError as exc:
            raise AuthVerificationUnavailable("Authentication verification is temporarily unavailable") from exc
        if response.status_code == 401:
            # Gateway configuration errors must not invalidate a user's sign-in.
            if "invalid api key" in response.text.lower():
                raise AuthVerificationUnavailable("Auth validation gateway key is not configured correctly")
            raise AuthTokenError("Invalid or expired access token")
        if response.status_code == 403:
            raise AuthAccessDenied("Access to this account is denied")
        if not response.is_success:
            raise AuthVerificationUnavailable("Authentication verification is temporarily unavailable")
        try:
            user = response.json()
            if user.get("id") != claims["sub"]:
                raise AuthTokenError("Access token subject does not match the authenticated user")
        except (TypeError, ValueError, AttributeError) as exc:
            if isinstance(exc, AuthTokenError):
                raise
            raise AuthVerificationUnavailable("Authentication verification returned an invalid response") from exc

    @staticmethod
    def _to_user(claims: Mapping[str, object]) -> AuthenticatedUser:
        subject = claims.get("sub")
        if not isinstance(subject, str):
            raise AuthTokenError("Access token is missing a valid subject")

        try:
            user_id = UUID(subject)
        except ValueError as exc:
            raise AuthTokenError("Access token subject is not a UUID") from exc

        email = claims.get("email")
        session_id = claims.get("session_id")
        return AuthenticatedUser(
            id=user_id,
            email=email if isinstance(email, str) else None,
            session_id=session_id if isinstance(session_id, str) else None,
        )
