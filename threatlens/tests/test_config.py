import pytest
from pydantic import ValidationError

from app.config import Settings


def test_default_settings_are_development_safe() -> None:
    settings = Settings()

    assert settings.DEBUG is True
    assert settings.ENVIRONMENT == "development"
    assert settings.DATABASE_POOL_SIZE == 5
    assert settings.SUPABASE_SERVICE_ROLE_KEY == ""
    assert "http://localhost:5173" in settings.CORS_ORIGINS


def test_supabase_urls_are_derived_from_project_url() -> None:
    settings = Settings(SUPABASE_URL="https://project-ref.supabase.co")

    assert settings.SUPABASE_JWKS_URL.endswith("/auth/v1/.well-known/jwks.json")
    assert settings.SUPABASE_JWT_ISSUER.endswith("/auth/v1")


def test_comma_separated_lists_are_supported() -> None:
    settings = Settings(
        CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173",
        SUPABASE_JWT_ALGORITHMS="RS256,ES256",
    )

    assert settings.CORS_ORIGINS == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    assert settings.SUPABASE_JWT_ALGORITHMS == ["RS256", "ES256"]


def test_production_rejects_missing_supabase_configuration() -> None:
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="production", DEBUG=False)
