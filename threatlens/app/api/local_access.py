"""Explicitly opted-in, loopback-only compatibility API; never a hosted API."""
from ipaddress import ip_address
from urllib.parse import urlsplit

from fastapi import HTTPException, Request

from app.config import settings


def local_api_enabled() -> bool:
    return bool(settings.LOCAL_SCAN_ENABLED and settings.DEBUG
                and settings.ENVIRONMENT.lower() == "development")


def _loopback(host: str | None) -> bool:
    if host == "localhost":
        return True
    try:
        return ip_address(host or "").is_loopback
    except ValueError:
        return False


def require_local_access(request: Request) -> None:
    if not local_api_enabled():
        raise HTTPException(404, "Legacy local audits are disabled. Use the signed-in Codebase Audit workflow.")
    # Do not trust Forwarded/X-Forwarded-* for this unauthenticated compatibility API.
    if not request.client or not _loopback(request.client.host):
        raise HTTPException(403, "Local audits require a loopback connection.")
    try:
        host = urlsplit("//" + request.headers.get("host", ""))
        valid_host = (_loopback(host.hostname) and not host.username and not host.password
                      and not host.path and not host.query and not host.fragment)
        _ = host.port  # Reject malformed ports.
    except ValueError:
        valid_host = False
    if not valid_host:
        raise HTTPException(403, "Local audits require a loopback host.")
    origin = request.headers.get("origin")
    if origin is not None:
        try:
            parsed = urlsplit(origin)
            valid_origin = (origin in settings.CORS_ORIGINS and parsed.scheme in {"http", "https"}
                            and _loopback(parsed.hostname) and not parsed.username
                            and not parsed.password and not parsed.path and not parsed.query
                            and not parsed.fragment)
        except ValueError:
            valid_origin = False
        if not valid_origin:
            raise HTTPException(403, "This origin cannot use local audits.")
    elif request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site local audit requests are not allowed.")
