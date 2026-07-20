from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.rag.qdrant_client import RAGStorageError, framework_chunk_counts


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/frameworks", tags=["frameworks"])
QDRANT_COUNT_TIMEOUT_SECONDS = 2.0


class FrameworkResponse(BaseModel):
    id: str
    name: str
    version: str
    chunks_indexed: int


class FrameworkListResponse(BaseModel):
    frameworks: list[FrameworkResponse]


_FRAMEWORKS = (
    ("gdpr", "GDPR", "2016/679", "GDPR"),
    ("soc2", "SOC 2", "2017 TSC", "SOC2"),
    ("iso27001", "ISO 27001", "2022", "ISO27001"),
    ("pci_dss", "PCI DSS", "4.0.1", "PCI_DSS"),
    ("nist_csf", "NIST CSF", "2.0", "NIST_CSF"),
)


@router.get("", response_model=FrameworkListResponse)
async def list_frameworks() -> FrameworkListResponse:
    qdrant_names = tuple(item[3] for item in _FRAMEWORKS)
    try:
        counts = await asyncio.wait_for(
            asyncio.to_thread(framework_chunk_counts, qdrant_names),
            timeout=QDRANT_COUNT_TIMEOUT_SECONDS,
        )
    except (RAGStorageError, TimeoutError):
        logger.warning("Qdrant is unavailable; returning framework metadata with zero indexed chunks")
        counts = dict.fromkeys(qdrant_names, 0)

    return FrameworkListResponse(
        frameworks=[
            FrameworkResponse(
                id=framework_id,
                name=name,
                version=version,
                chunks_indexed=counts[qdrant_name],
            )
            for framework_id, name, version, qdrant_name in _FRAMEWORKS
        ]
    )
