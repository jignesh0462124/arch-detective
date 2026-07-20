import pytest
from pydantic import ValidationError

from app.config import Settings


def test_default_settings_are_development_safe() -> None:
    settings = Settings()

    assert settings.DEBUG is True
    assert "localhost" in settings.DATABASE_URL
    assert "http://localhost:5173" in settings.CORS_ORIGINS
    assert len(settings.SECRET_KEY) >= 64


def test_cors_origins_accept_comma_separated_env_value() -> None:
    settings = Settings(CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173")

    assert settings.CORS_ORIGINS == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_production_rejects_development_secrets() -> None:
    with pytest.raises(ValidationError):
        Settings(DEBUG=False)
