from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.rag.chunkers import (  # noqa: E402
    Chunk,
    chunk_gdpr,
    chunk_iso27001,
    chunk_nist,
    chunk_owasp,
    chunk_pci,
    chunk_soc2,
    fetch_nvd_cves,
)
from app.rag.chunkers.cve_chunker import NVDClientError  # noqa: E402
from app.rag.qdrant_client import create_collection, upsert_chunks  # noqa: E402


def local_chunks() -> list[Chunk]:
    chunks: list[Chunk] = []
    for chunker in (
        chunk_gdpr,
        chunk_soc2,
        chunk_iso27001,
        chunk_pci,
        chunk_nist,
        chunk_owasp,
    ):
        chunks.extend(chunker())
    return chunks


async def seed_rag(recreate: bool = False, include_nvd: bool = True) -> int:
    chunks = local_chunks()
    if include_nvd:
        try:
            chunks.extend(await fetch_nvd_cves())
        except NVDClientError as exc:
            print(f"Warning: {exc}. Continuing with the local compliance catalog.")

    await asyncio.to_thread(create_collection, recreate)
    inserted = await asyncio.to_thread(upsert_chunks, chunks)
    print(f"Seeded {inserted} chunks into Qdrant.")
    return inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the ThreatLens RAG knowledge base")
    parser.add_argument("--recreate", action="store_true", help="Replace the existing collection")
    parser.add_argument("--skip-nvd", action="store_true", help="Skip the optional live NVD request")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    asyncio.run(seed_rag(recreate=arguments.recreate, include_nvd=not arguments.skip_nvd))
