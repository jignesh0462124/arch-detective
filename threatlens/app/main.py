"""ThreatLens FastAPI application entry point."""
from __future__ import annotations

import logging
import asyncio
from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
    HAS_SLOWAPI = True
except ImportError:
    HAS_SLOWAPI = False
    limiter = None
    RateLimitExceeded = Exception
    _rate_limit_exceeded_handler = None
    SlowAPIMiddleware = None

from app.api import api_router
from app.api.local_scan import router as local_scan_router
from app.config import settings
from app.middleware.request_logging import RequestLoggingMiddleware

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
# HTTP request URLs can contain user-entered source searches. Keep them out of logs.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# ── Sentry (optional) ─────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
    except ImportError:
        logging.warning("sentry-sdk not installed — Sentry disabled")

# ── App ───────────────────────────────────────────────────────────────────────
_START_TIME = time.time()


@asynccontextmanager
async def lifespan(_app):
    from app.api.audit_workbench import maintenance_loop, _tasks
    from app.storage.workbench_store import open_workbench_connections, close_workbench_connections
    await open_workbench_connections()
    maintenance = asyncio.create_task(maintenance_loop())
    try:
        yield
    finally:
        maintenance.cancel()
        for task in list(_tasks):
            task.cancel()
        await asyncio.gather(maintenance, *list(_tasks), return_exceptions=True)
        await close_workbench_connections()

app = FastAPI(
    lifespan=lifespan,
    title="ThreatLens API",
    description="LLM-Agentic Compliance & Threat Modeling Engine",
    version="1.0.0",
)

if HAS_SLOWAPI and limiter is not None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.add_middleware(SlowAPIMiddleware)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Request logging must be innermost so it captures final status codes
app.add_middleware(RequestLoggingMiddleware)

app.include_router(api_router)
app.include_router(local_scan_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Fast health check: reports readiness of API and local in-process scanner."""
    components: dict[str, str] = {
        "api": "ok",
        "local_scanner": "ready",
    }

    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": "threatlens",
            "version": "1.0.0",
            "uptime_seconds": round(time.time() - _START_TIME),
            "components": components,
        },
    )


# ── Sentry smoke-test ─────────────────────────────────────────────────────────
@app.get("/debug/sentry-test", include_in_schema=False)
async def sentry_test(request: Request) -> dict:
    raise RuntimeError("Sentry test error — ignore")
