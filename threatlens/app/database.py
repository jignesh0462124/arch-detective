from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


# ── Async engine (FastAPI) ────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── Sync engine (Celery workers) ──────────────────────────────────────────────
# Workers run in sync context; convert asyncpg URL to psycopg2.
_sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2", 1)
try:
    sync_engine = create_engine(
        _sync_url,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        pool_recycle=1800,
    )
    SyncSessionLocal: sessionmaker[Session] = sessionmaker(
        bind=sync_engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
except Exception as _engine_exc:
    # Sync engine is optional at import time (e.g. missing psycopg2 in some
    # dev/test envs). Keep import working, but fail LOUDLY on first use
    # instead of "NoneType is not callable" deep inside Celery tasks.
    sync_engine = None  # type: ignore[assignment]
    _sync_engine_error: Exception | None = _engine_exc

    class _MissingSyncSession:
        def __call__(self, *args: object, **kwargs: object) -> object:
            raise RuntimeError(
                "Sync database engine is unavailable: "
                f"{_sync_engine_error}. Check DATABASE_URL and psycopg2 install."
            ) from _sync_engine_error

        def __getattr__(self, name: str) -> object:
            def _missing(*args: object, **kwargs: object) -> object:
                raise RuntimeError(
                    "Sync database engine is unavailable: "
                    f"{_sync_engine_error}. Check DATABASE_URL and psycopg2 install."
                ) from _sync_engine_error

            return _missing

    SyncSessionLocal = _MissingSyncSession()  # type: ignore[assignment]

