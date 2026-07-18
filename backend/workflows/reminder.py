"""
Durable reminder workflow (Temporal).

Why Temporal instead of the old `asyncio.sleep` background task:
- The timer is persisted in the Temporal server — a backend redeploy,
  crash, or scale-down between scheduling and firing can no longer
  silently lose a patient's reminder call.
- Each step (LLM message generation, telephony call) is an *activity*
  with a declarative retry policy — a transient Groq or Exotel failure
  retries itself with backoff instead of dropping the reminder.
- Every workflow execution has a full, inspectable history in the
  Temporal UI — an audit trail for "did we actually call the patient?"

Workflow code must be deterministic: no I/O, no clocks, no randomness
here — all side effects live in activities.
"""
import asyncio
from dataclasses import dataclass
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from services.exotel_service import initiate_reminder_call
    from services.llm_service import generate_outbound_message


@dataclass
class ReminderInput:
    phone: str
    patient_name: str
    doctor: str
    date: str
    time: str
    delay_seconds: int
    language: str = "English"
    purpose: str = "reminder"


@activity.defn
async def generate_reminder_message(input: ReminderInput) -> str:
    """LLM-generated spoken reminder text (retryable)."""
    return await generate_outbound_message(
        name=input.patient_name,
        doctor=input.doctor,
        date=input.date,
        time=input.time,
        purpose=input.purpose,
        language=input.language,
    )


@activity.defn
async def place_reminder_call(input: ReminderInput) -> dict:
    """Trigger the Exotel click-to-call (retryable). Gracefully reports
    when telephony credentials are not configured."""
    return initiate_reminder_call(
        phone=input.phone,
        patient_name=input.patient_name,
        doctor=input.doctor,
        appt_date=input.date,
        appt_time=input.time,
    )


@workflow.defn
class ReminderWorkflow:
    @workflow.run
    async def run(self, input: ReminderInput) -> dict:
        # Durable timer — survives worker and server restarts. Inside a
        # workflow, asyncio.sleep IS a Temporal timer (the SDK's
        # deterministic event loop persists it as a timer event).
        if input.delay_seconds > 0:
            await asyncio.sleep(input.delay_seconds)

        message = await workflow.execute_activity(
            generate_reminder_message,
            input,
            start_to_close_timeout=timedelta(seconds=45),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=5),
                backoff_coefficient=2.0,
                maximum_interval=timedelta(minutes=1),
                maximum_attempts=4,
            ),
        )

        call_result = await workflow.execute_activity(
            place_reminder_call,
            input,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                initial_interval=timedelta(seconds=10),
                backoff_coefficient=2.0,
                maximum_interval=timedelta(minutes=2),
                maximum_attempts=3,
                # A missing credential will never succeed on retry.
                non_retryable_error_types=[],
            ),
        )

        return {
            "message": message,
            "call": call_result,
            "patient": input.patient_name,
            "doctor": input.doctor,
            "scheduled_for": f"{input.date} {input.time}",
        }
