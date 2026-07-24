from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.scan import Scan
from app.storage.client import StorageOperationError, SupabaseStorage
from app.storage.lifecycle import delete_object_if_present
from app.tasks.celery_app import celery_app


@celery_app.task(name="threatlens.scan.ingest")
def ingest_scan(scan_id: str) -> dict[str, str]:
    UUID(scan_id)
    return {"scan_id": scan_id, "status": "queued"}


async def _cleanup_scan(scan_id: UUID) -> bool:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Scan).options(selectinload(Scan.artifacts)).where(Scan.id == scan_id)
        )
        scan = result.scalar_one_or_none()
        if scan is None:
            return False

        storage = SupabaseStorage()
        for artifact in scan.artifacts:
            await asyncio.to_thread(
                delete_object_if_present,
                storage,
                artifact.bucket,
                artifact.object_path,
            )
        await db.delete(scan)
        await db.commit()
        return True


@celery_app.task(
    name="threatlens.scan.cleanup",
    autoretry_for=(StorageOperationError,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)
def cleanup_scan(scan_id: str) -> dict[str, object]:
    parsed_scan_id = UUID(scan_id)
    deleted = asyncio.run(_cleanup_scan(parsed_scan_id))
    return {"scan_id": scan_id, "deleted": deleted}
