"""Structured JSON request logging middleware."""
from __future__ import annotations

import json
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

import logging

logger = logging.getLogger("threatlens.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Injects x-request-id into each request and emits a structured JSON log
    after every response: { timestamp, level, request_id, method, path,
    status, duration_ms, user_id }.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            _emit(request, request_id, 500, duration_ms)
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["x-request-id"] = request_id
        _emit(request, request_id, response.status_code, duration_ms)
        return response


def _emit(request: Request, request_id: str, status: int, duration_ms: float) -> None:
    record: dict = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "level": "INFO" if status < 400 else ("WARN" if status < 500 else "ERROR"),
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status": status,
        "duration_ms": duration_ms,
    }
    # Safe user_id extraction from JWT — already parsed in state if auth ran
    uid = getattr(getattr(request.state, "user", None), "id", None)
    if uid:
        record["user_id"] = str(uid)

    logger.info(json.dumps(record))
