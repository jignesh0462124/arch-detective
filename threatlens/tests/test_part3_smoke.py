import os
from uuid import uuid4

import pytest

from app.config import settings
from app.storage.client import SupabaseStorage
from app.tasks.scan_task import ingest_scan


@pytest.mark.skipif(
    os.getenv("THREATLENS_RUN_SUPABASE_SMOKE") != "1",
    reason="Real Supabase smoke test is opt-in",
)
def test_real_supabase_scan_object_is_reachable() -> None:
    object_path = os.environ["THREATLENS_SMOKE_OBJECT_PATH"]
    storage = SupabaseStorage()
    assert storage.exists(settings.SUPABASE_SCAN_BUCKET, object_path)


@pytest.mark.skipif(
    os.getenv("THREATLENS_RUN_REDIS_SMOKE") != "1",
    reason="Real Redis worker smoke test is opt-in",
)
def test_real_redis_worker_processes_ingestion_stub() -> None:
    scan_id = str(uuid4())
    result = ingest_scan.delay(scan_id).get(timeout=15)
    assert result == {"scan_id": scan_id, "status": "queued"}
