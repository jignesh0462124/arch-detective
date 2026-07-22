from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache
from typing import Any, TypeVar
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.config import settings
from app.rag.chunkers.base import Chunk
from app.rag.embedder import EMBEDDING_DIMENSION, encode_batch


T = TypeVar("T")


class RAGStorageError(RuntimeError):
    """Raised when Qdrant cannot complete an operation."""


def _batches(items: list[T], size: int) -> Iterator[list[T]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    connection = (
        {"url": settings.QDRANT_URL}
        if settings.QDRANT_URL
        else {
            "host": settings.QDRANT_HOST,
            "port": settings.QDRANT_PORT,
            "https": settings.QDRANT_HTTPS,
        }
    )
    return QdrantClient(
        **connection,
        api_key=settings.QDRANT_API_KEY or None,
        timeout=settings.QDRANT_TIMEOUT_SECONDS,
    )


def create_collection(recreate: bool = False, client: QdrantClient | None = None) -> None:
    qdrant = client or get_qdrant()
    try:
        exists = qdrant.collection_exists(settings.QDRANT_COLLECTION)
        if recreate and exists:
            qdrant.delete_collection(settings.QDRANT_COLLECTION)
            exists = False
        if not exists:
            qdrant.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=EMBEDDING_DIMENSION, distance=Distance.COSINE),
            )
    except Exception as exc:
        raise RAGStorageError("Unable to create the Qdrant collection") from exc


def _point_id(chunk: Chunk) -> str:
    metadata = chunk["metadata"]
    identity = "|".join(
        (
            str(metadata.get("framework", "")),
            str(metadata.get("control_id", "")),
            str(metadata.get("chunk_type", "")),
            str(chunk["text"]),
        )
    )
    return str(uuid5(NAMESPACE_URL, identity))


def upsert_chunks(
    chunks: list[Chunk],
    batch_size: int = 100,
    client: QdrantClient | None = None,
) -> int:
    if batch_size < 1 or batch_size > 1_000:
        raise ValueError("batch_size must be between 1 and 1000")
    if not chunks:
        return 0

    qdrant = client or get_qdrant()
    inserted = 0
    try:
        for batch in _batches(chunks, batch_size):
            vectors = encode_batch([str(chunk["text"]) for chunk in batch])
            points = []
            for chunk, vector in zip(batch, vectors, strict=True):
                payload: dict[str, Any] = {
                    "text": chunk["text"],
                    **dict(chunk["metadata"]),
                }
                points.append(PointStruct(id=_point_id(chunk), vector=vector, payload=payload))
            qdrant.upsert(
                collection_name=settings.QDRANT_COLLECTION,
                points=points,
                wait=True,
            )
            inserted += len(points)
    except Exception as exc:
        raise RAGStorageError("Unable to upsert chunks into Qdrant") from exc
    return inserted


def framework_chunk_counts(
    frameworks: tuple[str, ...],
    client: QdrantClient | None = None,
) -> dict[str, int]:
    qdrant = client or get_qdrant()
    counts: dict[str, int] = {}
    try:
        for framework in frameworks:
            result = qdrant.count(
                collection_name=settings.QDRANT_COLLECTION,
                count_filter=Filter(
                    must=[FieldCondition(key="framework", match=MatchValue(value=framework))]
                ),
                exact=True,
            )
            counts[framework] = result.count
    except Exception as exc:
        raise RAGStorageError("Unable to count framework chunks") from exc
    return counts
