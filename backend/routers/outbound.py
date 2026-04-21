from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, timedelta
from typing import Optional
import logging
import asyncio

from database.database import get_db
from database.models import Appointment, OutboundCampaign
from services.exotel_service import initiate_reminder_call
from services.llm_service import generate_outbound_message

logger = logging.getLogger(__name__)
router = APIRouter()


class TriggerRequest(BaseModel):
    appointment_id: str
    phone: str


class SimulateRequest(BaseModel):
    appointment_id: str


class GenerateMessageRequest(BaseModel):
    name: str
    doctor: str
    date: str
    time: str
    purpose: str          # "reminder" | "followup" | "missed"
    language: str = "English"   # "English" | "Hindi" | "Tamil"


class PatientResponseRequest(BaseModel):
    appointment_id: str
    response: str         # "confirm" | "reschedule" | "no"


# ── Live Exotel call ───────────────────────────────────────
@router.post("/outbound/trigger")
async def trigger_call(req: TriggerRequest, db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(
        Appointment.id == req.appointment_id,
        Appointment.status == "scheduled",
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    result = initiate_reminder_call(
        phone=req.phone,
        patient_name=appt.patient_name,
        doctor=appt.doctor,
        appt_date=appt.date,
        appt_time=appt.time,
    )

    campaign = OutboundCampaign(
        appointment_id=req.appointment_id,
        phone=req.phone,
        status="pending" if result.get("success") else "failed",
        call_sid=result.get("call_sid", ""),
    )
    db.add(campaign)
    db.commit()
    return result


# ── Simulation mode (no Exotel needed) ────────────────────
@router.post("/outbound/simulate")
async def simulate_reminder(req: SimulateRequest, db: Session = Depends(get_db)):
    """Returns the reminder payload the AI would speak — for demo/testing."""
    appt = db.query(Appointment).filter(Appointment.id == req.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Generate AI message
    message = await generate_outbound_message(
        name=appt.patient_name,
        doctor=appt.doctor,
        date=appt.date,
        time=appt.time,
        purpose="reminder",
        language="English" # Default for simulation
    )

    return {
        "type": "outbound_reminder",
        "appointment_id": appt.id,
        "patient_name": appt.patient_name,
        "doctor": appt.doctor,
        "date": appt.date,
        "time": appt.time,
        "message": message
    }


# ── Exotel webhook ─────────────────────────────────────────
@router.post("/outbound/webhook")
async def exotel_webhook(request: Request, db: Session = Depends(get_db)):
    """Handles Exotel call-status callbacks (DTMF digit presses)."""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    digits   = form.get("Digits", "")
    status   = form.get("Status", "")

    logger.info(f"Exotel webhook: SID={call_sid} Status={status} Digits={digits}")

    campaign = db.query(OutboundCampaign).filter(
        OutboundCampaign.call_sid == call_sid
    ).first()

    if campaign:
        if digits == "1":
            campaign.status = "confirmed"
        elif digits == "2":
            campaign.status = "rescheduled"
        elif digits == "3":
            campaign.status = "rejected"
            appt = db.query(Appointment).filter(
                Appointment.id == campaign.appointment_id
            ).first()
            if appt:
                appt.status = "cancelled"
        db.commit()

    return {"status": "ok"}


# ── Upcoming reminder list ─────────────────────────────────
@router.get("/outbound/upcoming-reminders")
def upcoming_reminders(db: Session = Depends(get_db)):
    """Returns tomorrow's appointments — candidates for reminder calls."""
    tomorrow = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    rows = (
        db.query(Appointment)
        .filter(Appointment.date == tomorrow, Appointment.status == "scheduled")
        .all()
    )
    return [
        {
            "appointment_id": a.id,
            "patient_name":   a.patient_name,
            "doctor":         a.doctor,
            "date":           a.date,
            "time":           a.time,
        }
        for a in rows
    ]


# ── AI-generated outbound message ───────────────────────────
@router.post("/outbound/generate-message")
async def generate_message(req: GenerateMessageRequest):
    """
    Use the LLM to generate a short, multilingual spoken message
    for an outbound patient call. Supports: reminder, followup, missed.
    """
    message = await generate_outbound_message(
        name=req.name,
        doctor=req.doctor,
        date=req.date,
        time=req.time,
        purpose=req.purpose,
        language=req.language,
    )
    return {
        "purpose":  req.purpose,
        "language": req.language,
        "message":  message,
    }


# ── Handle patient call response ────────────────────────────
@router.post("/outbound/respond")
async def handle_patient_response(
    req: PatientResponseRequest,
    db: Session = Depends(get_db),
):
    """
    Handle the patient's verbal/button response during an outbound call.
    - confirm    → mark appointment as confirmed
    - reschedule → initiate rescheduling (returns action to caller)
    - no / cancel→ acknowledge and end
    """
    appt = db.query(Appointment).filter(Appointment.id == req.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    response_lower = req.response.strip().lower()

    if response_lower in ("confirm", "yes", "yes confirm", "1"):
        appt.status = "confirmed"
        db.commit()
        return {
            "action":  "confirmed",
            "message": f"Great! Your appointment with {appt.doctor} on {appt.date} at {appt.time} is confirmed. See you then!",
        }

    elif response_lower in ("reschedule", "2"):
        return {
            "action":  "reschedule",
            "message": "Sure! Please let us know your preferred date and time and we will reschedule your appointment.",
            "appointment_id": appt.id,
        }

    else:  # "no", "cancel", "3", etc.
        return {
            "action":  "acknowledged",
            "message": "Understood. Thank you for your time. Have a great day!",
        }


# ── Demo Trigger: delayed call without appointment ID ────────
class TriggerDemoRequest(BaseModel):
    phone: str
    patient_name: str
    doctor: str
    date: str
    time: str
    delay_minutes: int = 1   # how many minutes to wait before calling
    language: str = "English"


async def _delayed_call(
    phone: str,
    patient_name: str,
    doctor: str,
    appt_date: str,
    appt_time: str,
    delay_minutes: int,
    language: str,
):
    """Wait `delay_minutes` then fire the Exotel call."""
    await asyncio.sleep(delay_minutes * 60)
    logger.info(f"Demo trigger: calling {phone} for {patient_name} after {delay_minutes}m")
    initiate_reminder_call(
        phone=phone,
        patient_name=patient_name,
        doctor=doctor,
        appt_date=appt_date,
        appt_time=appt_time,
    )


@router.post("/outbound/trigger-demo")
async def trigger_demo_call(req: TriggerDemoRequest, background_tasks: BackgroundTasks):
    """
    Schedule a live Exotel reminder call for demo purposes.
    The call fires after `delay_minutes` without needing a DB appointment.
    The AI will ask if the patient is available with the specified doctor.
    """
    if not req.phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    background_tasks.add_task(
        _delayed_call,
        phone=req.phone,
        patient_name=req.patient_name,
        doctor=req.doctor,
        appt_date=req.date,
        appt_time=req.time,
        delay_minutes=req.delay_minutes,
        language=req.language,
    )

    return {
        "success": True,
        "message": f"✅ Reminder call scheduled! You will receive a call at {req.phone} in {req.delay_minutes} minute(s).",
        "delay_minutes": req.delay_minutes,
        "phone": req.phone,
        "doctor": req.doctor,
    }
