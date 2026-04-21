from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, timedelta
import logging

from database.database import get_db
from database.models import Appointment, OutboundCampaign
from services.exotel_service import initiate_reminder_call

logger = logging.getLogger(__name__)
router = APIRouter()


class TriggerRequest(BaseModel):
    appointment_id: str
    phone: str


class SimulateRequest(BaseModel):
    appointment_id: str


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

    return {
        "type": "outbound_reminder",
        "appointment_id": appt.id,
        "patient_name": appt.patient_name,
        "doctor": appt.doctor,
        "date": appt.date,
        "time": appt.time,
        "message": (
            f"Hello {appt.patient_name}, this is a reminder from the clinic. "
            f"You have an appointment with {appt.doctor} on {appt.date} at {appt.time}. "
            f"Would you like to confirm, reschedule, or cancel?"
        ),
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
