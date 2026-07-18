"""
Workflow tests against Temporal's time-skipping test environment: the
durable timer and retry semantics run for real (a local test server is
auto-downloaded on first run), while activities are mocked so no Groq
or Exotel calls happen.
"""
import asyncio
import sys
import uuid
from pathlib import Path

from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from workflows.reminder import ReminderInput, ReminderWorkflow

TASK_QUEUE = "test-reminders"


def make_input(delay=3600):
    return ReminderInput(
        phone="+911234567890",
        patient_name="Asha",
        doctor="Dr Ananya Iyer",
        date="2026-08-01",
        time="10:00",
        delay_seconds=delay,
    )


@activity.defn(name="generate_reminder_message")
async def fake_generate(input: ReminderInput) -> str:
    return f"Hello {input.patient_name}, reminder for {input.doctor}."


@activity.defn(name="place_reminder_call")
async def fake_call(input: ReminderInput) -> dict:
    return {"success": True, "call_sid": "TEST123"}


def test_workflow_waits_delay_then_calls():
    async def scenario():
        async with await WorkflowEnvironment.start_time_skipping() as env:
            async with Worker(
                env.client, task_queue=TASK_QUEUE,
                workflows=[ReminderWorkflow],
                activities=[fake_generate, fake_call],
            ):
                # 1 hour delay — time-skipping env fast-forwards through
                # the durable timer instead of sleeping.
                result = await env.client.execute_workflow(
                    ReminderWorkflow.run,
                    make_input(delay=3600),
                    id=f"wf-{uuid.uuid4().hex[:8]}",
                    task_queue=TASK_QUEUE,
                )
        assert result["call"] == {"success": True, "call_sid": "TEST123"}
        assert "Asha" in result["message"]
        assert result["scheduled_for"] == "2026-08-01 10:00"

    asyncio.run(scenario())


def test_activity_failures_are_retried():
    attempts = {"n": 0}

    @activity.defn(name="place_reminder_call")
    async def flaky_call(input: ReminderInput) -> dict:
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise RuntimeError("exotel transient failure")
        return {"success": True, "call_sid": "AFTER-RETRY"}

    async def scenario():
        async with await WorkflowEnvironment.start_time_skipping() as env:
            async with Worker(
                env.client, task_queue=TASK_QUEUE,
                workflows=[ReminderWorkflow],
                activities=[fake_generate, flaky_call],
            ):
                result = await env.client.execute_workflow(
                    ReminderWorkflow.run,
                    make_input(delay=0),
                    id=f"wf-{uuid.uuid4().hex[:8]}",
                    task_queue=TASK_QUEUE,
                )
        assert attempts["n"] == 3                       # retried twice, then succeeded
        assert result["call"]["call_sid"] == "AFTER-RETRY"

    asyncio.run(scenario())


def test_scheduler_falls_back_in_process(monkeypatch):
    """Without TEMPORAL_ADDRESS the scheduler uses the in-process timer."""
    from config import settings
    from services import scheduler_service

    monkeypatch.setattr(settings, "TEMPORAL_ADDRESS", "")

    async def scenario():
        result = await scheduler_service.schedule_reminder(
            phone="+911234567890", patient_name="Asha", doctor="Dr X",
            date="2026-08-01", time="10:00", delay_seconds=3600,
        )
        assert result["scheduler"] == "in-process"
        assert result["workflow_id"] is None
        assert len(scheduler_service._fallback_tasks) == 1
        for t in scheduler_service._fallback_tasks:
            t.cancel()

    asyncio.run(scenario())
