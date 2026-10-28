import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.local_access import require_local_access
from app.config import settings
from app.main import app


@pytest.mark.parametrize("enabled,environment,debug,peer,host,origin,expected", [
    (False, "development", True, "127.0.0.1", "localhost", None, 404),
    (True, "production", True, "127.0.0.1", "localhost", None, 404),
    (True, "development", False, "127.0.0.1", "localhost", None, 404),
    (True, "development", True, "203.0.113.1", "localhost", None, 403),
    (True, "development", True, "127.0.0.1", "evil.example", None, 403),
    (True, "development", True, "127.0.0.1", "localhost@evil.example", None, 403),
    (True, "development", True, "127.0.0.1", "localhost", "null", 403),
    (True, "development", True, "127.0.0.1", "localhost", "https://evil.example", 403),
    (True, "development", True, "127.0.0.1", "localhost", "http://127.0.0.1:5173", 200),
    (True, "development", True, "::1", "[::1]:8000", None, 200),
])
def test_local_access(monkeypatch, enabled, environment, debug, peer, host, origin, expected):
    monkeypatch.setattr(settings, "LOCAL_SCAN_ENABLED", enabled)
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "DEBUG", debug)
    fixture = FastAPI()

    @fixture.middleware("http")
    async def fixture_peer(request, call_next):
        request.scope["client"] = (peer, 32123)
        return await call_next(request)

    @fixture.api_route("/local", methods=["GET", "POST", "DELETE"], dependencies=[Depends(require_local_access)])
    def local():
        return {"ok": True}

    headers = {"host": host, "x-forwarded-for": "127.0.0.1"}
    if origin is not None:
        headers["origin"] = origin
    client = TestClient(fixture)
    for method in ("GET", "POST", "DELETE"):
        assert client.request(method, "/local", headers=headers).status_code == expected


def test_no_public_error_endpoint():
    assert TestClient(app).get("/debug/sentry-test").status_code == 404
