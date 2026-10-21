from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "threatlens/.env", "../threatlens/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Local defaults keep imports and unit tests usable. Production must override both.
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:54322/postgres"
    MIGRATION_DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = Field(default=5, ge=1, le=20)
    DATABASE_MAX_OVERFLOW: int = Field(default=5, ge=0, le=20)

    SUPABASE_URL: str = ""
    SUPABASE_JWKS_URL: str = ""
    SUPABASE_JWT_ISSUER: str = ""
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ALGORITHMS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["RS256", "ES256"],
    )
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_SCAN_BUCKET: str = "scan-inputs"
    SUPABASE_REPORT_BUCKET: str = "audit-reports"
    SIGNED_URL_TTL_SECONDS: int = Field(default=300, ge=30, le=3600)
    SOURCE_RETENTION_HOURS: int = Field(default=24, ge=0, le=720)
    AUDIT_WORKBENCH_ENABLED: bool = True
    AUDIT_WORKBENCH_PROGRESSIVE_ENABLED: bool = False
    SNAPSHOT_RETENTION_HOURS: int = Field(default=720, ge=1, le=720)
    # This bucket is protected by the migration's restrictive Storage policy.
    SUPABASE_SOURCE_BUCKET: Literal["audit-source"] = "audit-source"

    REDIS_URL: str = "redis://localhost:6379/0"

    QDRANT_URL: str = ""
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "compliance_knowledge"
    QDRANT_API_KEY: str = ""
    QDRANT_HTTPS: bool = False
    QDRANT_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=300)

    NVD_API_KEY: str = ""
    NVD_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=300)
    OMEGAPLUS_API_KEY: str = ""
    OMEGAPLUS_BASE_URL: str = "https://api.omegaplusapi.com/api/v1"
    OMEGAPLUS_MODEL: str = "glm-5-3-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"  # ultra-fast sub-second latency model

    # Observability
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    MAX_FILE_SIZE_MB: int = Field(default=50, ge=1, le=100)
    MAX_EXTRACTED_SIZE_MB: int = Field(default=500, ge=10, le=2_000)
    MAX_SOURCE_FILES: int = Field(default=1_000, ge=1, le=10_000)
    MAX_SOURCE_FILE_SIZE_MB: int = Field(default=2, ge=1, le=20)
    MAX_LOG_ENTRIES: int = Field(default=100_000, ge=100, le=1_000_000)
    GIT_CLONE_TIMEOUT_SECONDS: int = Field(default=120, ge=10, le=600)
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            "http://localhost:8082",
            "http://127.0.0.1:8082",
        ],
    )

    @field_validator("CORS_ORIGINS", "SUPABASE_JWT_ALGORITHMS", mode="before")
    @classmethod
    def parse_comma_separated_list(cls, value: str | list[str]) -> list[str] | str:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def derive_and_validate_settings(self) -> "Settings":
        base_url = self.SUPABASE_URL.rstrip("/")
        if base_url:
            if not self.SUPABASE_JWKS_URL:
                self.SUPABASE_JWKS_URL = f"{base_url}/auth/v1/.well-known/jwks.json"
            if not self.SUPABASE_JWT_ISSUER:
                self.SUPABASE_JWT_ISSUER = f"{base_url}/auth/v1"

        if self.ENVIRONMENT.lower() == "production" or not self.DEBUG:
            required = {
                "DATABASE_URL": self.DATABASE_URL,
                "SUPABASE_URL": self.SUPABASE_URL,
                "SUPABASE_JWKS_URL": self.SUPABASE_JWKS_URL,
                "SUPABASE_JWT_ISSUER": self.SUPABASE_JWT_ISSUER,
                "SUPABASE_SERVICE_ROLE_KEY": self.SUPABASE_SERVICE_ROLE_KEY,
            }
            missing = [name for name, value in required.items() if not value]
            if missing:
                raise ValueError(f"Missing production settings: {', '.join(missing)}")

            lowered = self.DATABASE_URL.lower()
            if "localhost" in lowered or "postgres:postgres" in lowered:
                raise ValueError("Production DATABASE_URL must use Supabase credentials")

            if "*" in self.CORS_ORIGINS:
                raise ValueError("Production CORS_ORIGINS must not contain '*'")

        return self

    @computed_field
    @property
    def SUPABASE_CONFIGURED(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_JWKS_URL)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
