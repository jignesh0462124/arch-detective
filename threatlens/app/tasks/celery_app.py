from celery import Celery

from app.config import settings


celery_app = Celery(
    "threatlens",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_time_limit=600,
    task_soft_time_limit=540,
    task_acks_late=True,
    timezone="UTC",
)
