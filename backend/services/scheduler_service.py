"""
Reminder scheduling with graceful degradation.

Temporal configured  → durable workflow (survives restarts, retries,
                       full history in the Temporal UI).
Temporal absent      → in-process asyncio timer, explicitly labelled
                       best-effort: it dies with the process. Kept so
                       local dev works with zero extra services.
"""
import asyncio
import logging
import uuid

from config import settings

logger = logging.getLogger(__name__)

_client = None
_client_lock = asyncio.Lock()


async def _get_client():
    global _client
    async with _client_lock:
        if _client is None:
            from temporalio.client import Client
            _client = await Client.connect(
                settings.TEMPORAL_ADDRESS, namespace=settings.TEMPORAL_NAMESPACE
            )
        return _client


async def schedule_reminder(
    *,
    phone: str,
    patient_name: str,
    doctor: str,
    date: str,
    time: str,
    delay_seconds: int,
    language: str = "English",
) -> dict:
    """Schedule a reminder call. Returns scheduler metadata."""
    if settings.TEMPORAL_ADDRESS:
        from workflows.reminder import ReminderInput, ReminderWorkflow

        client = await _get_client()
        workflow_id = f"reminder-{uuid.uuid4().hex[:12]}"
        await client.start_workflow(
            ReminderWorkflow.run,
            ReminderInput(
                phone=phone,
                patient_name=patient_name,
                doctor=doctor,
                date=date,
                time=time,
                delay_seconds=delay_seconds,
                language=language,
            ),
            id=workflow_id,
            task_queue=settings.TEMPORAL_TASK_QUEUE,
        )
        logger.info("Reminder scheduled durably: %s (+%ss)", workflow_id, delay_seconds)
        return {"scheduler": "temporal", "workflow_id": workflow_id}

    # ── Best-effort fallback (no Temporal) ────────────────
    async def _fire():
        await asyncio.sleep(delay_seconds)
        from services.exotel_service import initiate_reminder_call
        logger.info("In-process reminder firing for %s", patient_name)
        initiate_reminder_call(
            phone=phone, patient_name=patient_name, doctor=doctor,
            appt_date=date, appt_time=time,
        )

    task = asyncio.create_task(_fire())
    _fallback_tasks.add(task)
    task.add_done_callback(_fallback_tasks.discard)
    logger.warning(
        "Reminder scheduled IN-PROCESS (no TEMPORAL_ADDRESS) — it will "
        "be lost if the server restarts before firing."
    )
    return {"scheduler": "in-process", "workflow_id": None}


_fallback_tasks: set = set()


def scheduler_kind() -> str:
    return "temporal" if settings.TEMPORAL_ADDRESS else "in-process"
