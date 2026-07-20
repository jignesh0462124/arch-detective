from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    DATABASE_URL: str = (
        "postgresql+asyncpg://threatlens:threatlens_dev_password_change_me"
        "@localhost:5432/threatlens_db"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "compliance_knowledge"
    QDRANT_API_KEY: str = ""
    QDRANT_HTTPS: bool = False
    QDRANT_TIMEOUT_SECONDS: int = 30

    NVD_API_KEY: str = ""
    NVD_TIMEOUT_SECONDS: int = 30

    GROQ_API_KEY: str = ""

    S3_BUCKET_NAME: str = "threatlens-reports"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""

    SECRET_KEY: str = "dev-only-secret-key-change-me-before-production-0000000000000000"
    DEBUG: bool = True
    MAX_FILE_SIZE_MB: int = 50
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ],
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str] | str:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if not self.DEBUG:
            if len(self.SECRET_KEY) < 64 or "change-me" in self.SECRET_KEY:
                raise ValueError("SECRET_KEY must be a 64+ character production secret")
            if "password" in self.DATABASE_URL.lower() or "change_me" in self.DATABASE_URL:
                raise ValueError("DATABASE_URL must not use the development password in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
