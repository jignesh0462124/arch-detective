import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.fixture(autouse=True)
def isolated_settings_environment(monkeypatch):
    # Other modules may load dotenv at import time. Never test or print live keys.
    for name in Settings.model_fields:
        monkeypatch.delenv(name, raising=False)


def test_default_settings_are_development_safe() -> None:
    settings = Settings(_env_file=None)

    assert settings.DEBUG is True
    assert settings.ENVIRONMENT == "development"
    assert settings.DATABASE_POOL_SIZE == 5
    assert settings.SUPABASE_SERVICE_ROLE_KEY == ""
    assert "http://localhost:5173" in settings.CORS_ORIGINS


def test_supabase_urls_are_derived_from_project_url() -> None:
    settings = Settings(_env_file=None, SUPABASE_URL="https://project-ref.supabase.co")

    assert settings.SUPABASE_JWKS_URL.endswith("/auth/v1/.well-known/jwks.json")
    assert settings.SUPABASE_JWT_ISSUER.endswith("/auth/v1")


def test_comma_separated_lists_are_supported() -> None:
    settings = Settings(
        _env_file=None,
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
        Settings(_env_file=None, ENVIRONMENT="production", DEBUG=False)
