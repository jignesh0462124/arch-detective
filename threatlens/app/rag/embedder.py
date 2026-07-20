from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384


class EmbeddingError(RuntimeError):
    """Raised when the embedding model cannot encode input."""


@lru_cache(maxsize=1)
def get_encoder() -> "SentenceTransformer":
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME)
    except (ImportError, OSError, RuntimeError) as exc:
        raise EmbeddingError(f"Unable to load embedding model {MODEL_NAME}") from exc


def encode_batch(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if any(not text.strip() for text in texts):
        raise ValueError("Embedding input cannot contain blank text")

    try:
        vectors = get_encoder().encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        encoded = vectors.tolist()
    except (AttributeError, RuntimeError, ValueError) as exc:
        raise EmbeddingError("Unable to encode text") from exc

    if any(len(vector) != EMBEDDING_DIMENSION for vector in encoded):
        raise EmbeddingError(f"Expected {EMBEDDING_DIMENSION}-dimensional embeddings")
    return encoded


def encode_text(text: str) -> list[float]:
    return encode_batch([text])[0]
