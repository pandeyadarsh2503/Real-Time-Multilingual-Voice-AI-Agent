"""
Temporal worker — hosts the reminder workflow and its activities.

Run alongside the API when Temporal is configured:
    python worker.py
Requires TEMPORAL_ADDRESS (e.g. localhost:7233 for `temporal server
start-dev`, or temporal:7233 inside docker compose --profile temporal).
"""
import asyncio
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from config import settings
from workflows.reminder import (
    ReminderWorkflow,
    generate_reminder_message,
    place_reminder_call,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
logger = logging.getLogger("worker")


async def main():
    if not settings.TEMPORAL_ADDRESS:
        raise SystemExit("TEMPORAL_ADDRESS is not set — nothing to connect to.")

    client = await Client.connect(
        settings.TEMPORAL_ADDRESS, namespace=settings.TEMPORAL_NAMESPACE
    )
    logger.info("Connected to Temporal at %s", settings.TEMPORAL_ADDRESS)

    worker = Worker(
        client,
        task_queue=settings.TEMPORAL_TASK_QUEUE,
        workflows=[ReminderWorkflow],
        activities=[generate_reminder_message, place_reminder_call],
    )
    logger.info("Worker running on task queue '%s' — Ctrl+C to stop.", settings.TEMPORAL_TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
