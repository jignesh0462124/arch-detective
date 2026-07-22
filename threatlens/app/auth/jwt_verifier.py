import asyncio
from collections.abc import Mapping
from uuid import UUID

import jwt
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError
from pydantic import ValidationError

from app.config import Settings, settings
from app.schemas.auth import AuthenticatedUser


class AuthTokenError(ValueError):
    pass


class SupabaseJWTVerifier:
    def __init__(self, config: Settings = settings) -> None:
        if not config.SUPABASE_JWKS_URL:
            raise RuntimeError("SUPABASE_JWKS_URL is not configured")

        self._settings = config
        self._jwks_client = PyJWKClient(
            config.SUPABASE_JWKS_URL,
            cache_keys=True,
            lifespan=300,
        )

    async def verify(self, token: str) -> AuthenticatedUser:
        try:
            signing_key = await asyncio.to_thread(
                self._jwks_client.get_signing_key_from_jwt,
                token,
            )
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=self._settings.SUPABASE_JWT_ALGORITHMS,
                audience=self._settings.SUPABASE_JWT_AUDIENCE,
                issuer=self._settings.SUPABASE_JWT_ISSUER,
                options={"require": ["exp", "iat", "sub"]},
            )
        except (InvalidTokenError, PyJWKClientError, ValueError) as exc:
            raise AuthTokenError("Invalid or expired access token") from exc

        try:
            return self._to_user(claims)
        except ValidationError as exc:
            raise AuthTokenError("Access token contains invalid user claims") from exc

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
