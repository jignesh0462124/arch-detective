from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.rag import embedder, qdrant_client, retriever
from app.rag.chunkers import (
    chunk_gdpr,
    chunk_iso27001,
    chunk_nist,
    chunk_owasp,
    chunk_pci,
    chunk_soc2,
)
from app.rag.chunkers.cve_chunker import chunk_nvd_payload


def _local_chunks() -> list[dict[str, Any]]:
    return [
        chunk
        for chunker in (
            chunk_gdpr,
            chunk_soc2,
            chunk_iso27001,
            chunk_pci,
            chunk_nist,
            chunk_owasp,
        )
        for chunk in chunker()
    ]


def test_local_catalog_has_more_than_500_well_formed_chunks() -> None:
    chunks = _local_chunks()

    assert len(chunks) >= 500
    for chunk in chunks:
        assert chunk["text"].strip()
        assert {
            "framework",
            "control_id",
            "control_title",
            "category",
            "severity_weight",
            "chunk_type",
        } <= chunk["metadata"].keys()
        assert 0 <= chunk["metadata"]["severity_weight"] <= 1


def test_catalog_contains_required_credential_controls() -> None:
    controls = {
        (chunk["metadata"]["framework"], chunk["metadata"]["control_id"])
        for chunk in _local_chunks()
    }

    assert ("GDPR", "Art.32") in controls
    assert ("ISO27001", "A.8.5") in controls
    assert ("PCI_DSS", "Req.8.3.2") in controls


def test_encode_batch_returns_384_dimensions(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeVectors:
        def tolist(self) -> list[list[float]]:
            return [[0.0] * embedder.EMBEDDING_DIMENSION]

    class FakeEncoder:
        def encode(self, texts: list[str], **_: object) -> FakeVectors:
            assert texts == ["hardcoded password"]
            return FakeVectors()

    monkeypatch.setattr(embedder, "get_encoder", lambda: FakeEncoder())

    assert len(embedder.encode_text("hardcoded password")) == 384


def test_upsert_chunks_batches_and_uses_deterministic_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    chunks = chunk_gdpr()[:3]

    class FakeQdrant:
        def __init__(self) -> None:
            self.batches: list[list[Any]] = []

        def upsert(self, *, points: list[Any], **_: object) -> None:
            self.batches.append(points)

    client = FakeQdrant()
    monkeypatch.setattr(
        qdrant_client,
        "encode_batch",
        lambda texts: [[0.0] * 384 for _ in texts],
    )

    inserted = qdrant_client.upsert_chunks(chunks, batch_size=2, client=client)  # type: ignore[arg-type]

    assert inserted == 3
    assert [len(batch) for batch in client.batches] == [2, 1]
    assert client.batches[0][0].id == qdrant_client._point_id(chunks[0])


def test_retriever_filters_and_deduplicates_controls(monkeypatch: pytest.MonkeyPatch) -> None:
    hits = [
        SimpleNamespace(
            score=0.97,
            payload={
                "framework": "PCI_DSS",
                "control_id": "Req.8.3.2",
                "control_title": "Authentication factors",
                "text": "Protect authentication factors",
                "category": "Authentication",
                "severity_weight": 1.0,
            },
        ),
        SimpleNamespace(
            score=0.95,
            payload={
                "framework": "PCI_DSS",
                "control_id": "Req.8.3.2",
                "control_title": "Authentication factors",
                "text": "Duplicate facet",
                "category": "Authentication",
                "severity_weight": 1.0,
            },
        ),
        SimpleNamespace(
            score=0.91,
            payload={
                "framework": "PCI_DSS",
                "control_id": "Req.6.4.2",
                "control_title": "Web application protection",
                "text": "Prevent injection",
                "category": "Application security",
                "severity_weight": 1.0,
            },
        ),
    ]

    class FakeQdrant:
        def search(self, **kwargs: object) -> list[SimpleNamespace]:
            assert kwargs["query_filter"] is not None
            return hits

    monkeypatch.setattr(retriever, "get_qdrant", lambda: FakeQdrant())
    monkeypatch.setattr(retriever, "encode_text", lambda _: [0.0] * 384)

    results = retriever.retrieve_relevant_controls(
        "SQL injection",
        frameworks=["PCI_DSS"],
        top_k=10,
    )

    assert [result["control_id"] for result in results] == ["Req.8.3.2", "Req.6.4.2"]
    assert all(result["framework"] == "PCI_DSS" for result in results)


def test_framework_alias_validation() -> None:
    assert retriever.normalize_frameworks(["pci-dss", "GDPR"]) == ["PCI_DSS", "GDPR"]
    with pytest.raises(ValueError, match="Unsupported framework"):
        retriever.normalize_frameworks(["HIPAA"])


def test_nvd_payload_is_converted_to_chunk() -> None:
    chunks = chunk_nvd_payload(
        {
            "vulnerabilities": [
                {
                    "cve": {
                        "id": "CVE-2026-1234",
                        "published": "2026-07-01T00:00:00.000",
                        "lastModified": "2026-07-02T00:00:00.000",
                        "descriptions": [{"lang": "en", "value": "Example remote issue."}],
                        "metrics": {
                            "cvssMetricV31": [
                                {"cvssData": {"baseScore": 9.8, "baseSeverity": "CRITICAL"}}
                            ]
                        },
                        "weaknesses": [
                            {"description": [{"lang": "en", "value": "CWE-79"}]}
                        ],
                    }
                }
            ]
        }
    )

    assert chunks[0]["metadata"]["control_id"] == "CVE-2026-1234"
    assert chunks[0]["metadata"]["severity_weight"] == 0.98
