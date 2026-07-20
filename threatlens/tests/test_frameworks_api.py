from fastapi.testclient import TestClient

from app.main import app
from app.rag.qdrant_client import RAGStorageError


client = TestClient(app)


def test_frameworks_endpoint_returns_five_frameworks(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.frameworks.framework_chunk_counts",
        lambda frameworks: {framework: 20 for framework in frameworks},
    )

    response = client.get("/api/v1/frameworks")

    assert response.status_code == 200
    payload = response.json()["frameworks"]
    assert len(payload) == 5
    assert {framework["id"] for framework in payload} == {
        "gdpr",
        "soc2",
        "iso27001",
        "pci_dss",
        "nist_csf",
    }
    assert all(framework["chunks_indexed"] == 20 for framework in payload)


def test_frameworks_endpoint_degrades_when_qdrant_is_offline(monkeypatch) -> None:
    def unavailable(_: tuple[str, ...]) -> dict[str, int]:
        raise RAGStorageError("offline")

    monkeypatch.setattr("app.api.frameworks.framework_chunk_counts", unavailable)

    response = client.get("/api/v1/frameworks")

    assert response.status_code == 200
    assert all(item["chunks_indexed"] == 0 for item in response.json()["frameworks"])
