"""
Celery Configuration
Distributed task queue for scheduled jobs
"""
from celery import Celery
from ..config import settings

celery_app = Celery(
    "procura",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=["backend.tasks.discovery", "backend.tasks.follow_ups"]
)

# Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minute timeout
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "discovery-govcon-every-15min": {
        "task": "backend.tasks.discovery.run_discovery_task",
        "schedule": 900.0,  # 15 minutes
        "args": ["govcon"],
    },
    "discovery-sam-hourly": {
        "task": "backend.tasks.discovery.run_discovery_task",
        "schedule": 3600.0,  # 1 hour
        "args": ["sam"],
    },
    "discovery-usaspending-every-30min": {
        "task": "backend.tasks.discovery.run_discovery_task",
        "schedule": 1800.0,  # 30 minutes
        "args": ["usaspending"],
    },
    "follow-up-checks-every-hour": {
        "task": "backend.tasks.follow_ups.run_follow_up_checks",
        "schedule": 3600.0,  # 1 hour
    },
    "opportunity-sync-daily": {
        "task": "backend.tasks.follow_ups.sync_all_submission_opportunities",
        "schedule": 86400.0,  # 24 hours
    },
}
