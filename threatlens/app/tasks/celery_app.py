from celery import Celery
from celery.schedules import crontab

from app.config import settings


celery_app = Celery(
    "threatlens",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    imports=(
        "app.tasks.scan_task",
        "app.tasks.report_task",
    ),
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_time_limit=600,
    task_soft_time_limit=540,
    task_acks_late=True,
    timezone="UTC",
    # ── Separate queues by workload type ────────────────────────────────────
    task_routes={
        "threatlens.scan.run_full": {"queue": "scans"},
        "threatlens.scan.ingest": {"queue": "scans"},
        "threatlens.scan.cleanup_inputs": {"queue": "maintenance"},
        "threatlens.report.generate": {"queue": "reports"},
        "threatlens.rag.sync_nvd_cves": {"queue": "maintenance"},
    },
    task_default_queue="scans",
    # ── Celery Beat schedule ─────────────────────────────────────────────────
    beat_schedule={
        "sync-nvd-cves-weekly": {
            "task": "threatlens.rag.sync_nvd_cves",
            "schedule": crontab(hour=2, minute=0, day_of_week=1),  # Mon 02:00 UTC
            "options": {"queue": "maintenance"},
        },
    },
)
