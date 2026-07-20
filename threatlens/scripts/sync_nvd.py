from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.rag.chunkers import fetch_nvd_cves  # noqa: E402
from app.rag.qdrant_client import create_collection, upsert_chunks  # noqa: E402


async def sync_nvd(days: int = 30, limit: int = 1_000) -> int:
    chunks = await fetch_nvd_cves(days=days, limit=limit)
    await asyncio.to_thread(create_collection)
    inserted = await asyncio.to_thread(upsert_chunks, chunks)
    print(f"Synchronized {inserted} NVD CVE chunks.")
    return inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synchronize recent NVD CVEs into Qdrant")
    parser.add_argument("--days", type=int, default=30, help="Publication window in days")
    parser.add_argument("--limit", type=int, default=1_000, help="Maximum CVEs to fetch")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    asyncio.run(sync_nvd(days=arguments.days, limit=arguments.limit))
