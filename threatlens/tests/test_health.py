from fastapi.testclient import TestClient
import pytest

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code in {200, 503}
    body = response.json()
    assert body["service"] == "threatlens"
    assert "status" in body
    assert "components" in body



def test_openapi_docs_are_available() -> None:
    client = TestClient(app)

    response = client.get("/docs")

    assert response.status_code == 200
    assert "swagger-ui" in response.text


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"])
@pytest.mark.parametrize("path", ["/health", "/api/v1/audit-workbench/capabilities", "/api/v1/workspaces/00000000-0000-4000-8000-000000000001/finding-scans?offset=0", "/api/v1/workspaces/00000000-0000-4000-8000-000000000001/report-library"])
def test_frontend_origin_is_allowed_by_cors(origin: str, path: str) -> None:
    client = TestClient(app)

    response = client.options(
        path,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_untrusted_origins_are_not_allowed() -> None:
    response = TestClient(app).options("/health", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"})
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cross_origin_protected_reads_still_require_authentication() -> None:
    response = TestClient(app).get("/api/v1/workspaces/00000000-0000-4000-8000-000000000001/report-library", headers={"Origin": "http://127.0.0.1:5174"})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"
