import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import DOCTOR_NAMES, TIME_SLOTS, clinic_now, clinic_today
from database.models import (
    BLOCKING_STATUSES,
    STATUS_CANCELLED,
    STATUS_SCHEDULED,
    Appointment,
)


def _parse_date(date_str: str) -> Optional[date]:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def _slot_in_past(appt_date: date, time_str: str) -> bool:
    """True if the slot is today (clinic time) and already elapsed."""
    if appt_date != clinic_today():
        return False
    slot_time = datetime.strptime(time_str, "%H:%M").time()
    return slot_time <= clinic_now().time()


def _suggest_slots(doctor: str, date_str: str, db: Session, limit: int = 3) -> list:
    avail = check_availability(doctor, date_str, db)
    return avail.get("available_slots", [])[:limit]


def check_availability(doctor: str, date_str: str, db: Session) -> dict:
    """Return available 30-min slots for a doctor on a given date."""
    if doctor not in DOCTOR_NAMES:
        return {
            "error": f"Doctor '{doctor}' not found.",
            "available_doctors": DOCTOR_NAMES,
        }
    appt_date = _parse_date(date_str)
    if appt_date is None:
        return {"error": "Invalid date format. Please use YYYY-MM-DD."}

    if appt_date < clinic_today():
        return {"error": "Cannot check availability for past dates."}

    booked = db.query(Appointment).filter(
        Appointment.doctor == doctor,
        Appointment.date   == date_str,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).all()
    booked_times = {a.time for a in booked}

    available = [
        slot for slot in TIME_SLOTS
        if slot not in booked_times and not _slot_in_past(appt_date, slot)
    ]

    return {
        "doctor": doctor,
        "date": date_str,
        "available_slots": available,
        "total_available": len(available),
    }


def book_appointment(
    name: str,
    doctor: str,
    date_str: str,
    time_str: str,
    db: Session,
    patient_uid: Optional[str] = None,
) -> dict:
    """Book a slot after validation."""
    if doctor not in DOCTOR_NAMES:
        return {"error": f"Doctor '{doctor}' not found. Available: {', '.join(DOCTOR_NAMES)}"}

    appt_date = _parse_date(date_str)
    if appt_date is None:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}

    if appt_date < clinic_today():
        return {"error": "Cannot book appointments in the past."}

    if time_str not in TIME_SLOTS:
        return {"error": f"'{time_str}' is not a valid slot. Valid slots: {', '.join(TIME_SLOTS)}"}

    if _slot_in_past(appt_date, time_str):
        return {"error": "This time slot has already passed for today."}

    # ── Pessimistic lock: SELECT ... FOR UPDATE ───────────────
    # Real row lock on PostgreSQL; a plain SELECT on SQLite (which
    # serialises writes at the file level). The partial unique index
    # uq_active_slot is the authoritative guard either way.
    conflict = db.query(Appointment).filter(
        Appointment.doctor == doctor,
        Appointment.date   == date_str,
        Appointment.time   == time_str,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).with_for_update().first()

    if conflict:
        return {
            "error": f"Slot {time_str} is already booked for {doctor} on {date_str}.",
            "suggested_slots": _suggest_slots(doctor, date_str, db),
        }

    appt_id = str(uuid.uuid4())[:8].upper()
    appt = Appointment(
        id=appt_id,
        patient_uid=patient_uid,
        patient_name=name,
        doctor=doctor,
        date=date_str,
        time=time_str,
        status=STATUS_SCHEDULED,
    )
    try:
        db.add(appt)
        db.commit()
        db.refresh(appt)
    except IntegrityError:
        # Two concurrent requests both passed the availability check;
        # the DB index rejected the second INSERT.
        db.rollback()
        return {
            "error": f"Slot {time_str} was just booked by another request. Please choose a different time.",
            "suggested_slots": _suggest_slots(doctor, date_str, db),
        }

    return {
        "success": True,
        "appointment_id": appt_id,
        "patient_name": name,
        "doctor": doctor,
        "date": date_str,
        "time": time_str,
        "status": STATUS_SCHEDULED,
        "message": f"Appointment booked! ID: {appt_id}",
    }


def reschedule_appointment(appointment_id: str, new_date: str, new_time: str, db: Session) -> dict:
    """Move an existing active appointment to a new slot."""
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).first()

    if not appt:
        return {"error": f"Appointment '{appointment_id}' not found or already cancelled."}

    new_date_obj = _parse_date(new_date)
    if new_date_obj is None:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}

    if new_date_obj < clinic_today():
        return {"error": "Cannot reschedule to a past date."}

    if new_time not in TIME_SLOTS:
        return {"error": f"'{new_time}' is not a valid slot."}

    if _slot_in_past(new_date_obj, new_time):
        return {"error": "This time slot has already passed for today."}

    conflict = db.query(Appointment).filter(
        Appointment.doctor == appt.doctor,
        Appointment.date   == new_date,
        Appointment.time   == new_time,
        Appointment.status.in_(BLOCKING_STATUSES),
        Appointment.id     != appointment_id,
    ).with_for_update().first()

    if conflict:
        return {
            "error": f"Slot {new_time} on {new_date} is already booked.",
            "suggested_slots": _suggest_slots(appt.doctor, new_date, db),
        }

    old_date, old_time = appt.date, appt.time
    appt.date = new_date
    appt.time = new_time
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {
            "error": f"Slot {new_time} on {new_date} was just taken. Please pick another time.",
            "suggested_slots": _suggest_slots(appt.doctor, new_date, db),
        }

    return {
        "success": True,
        "appointment_id": appointment_id,
        "doctor": appt.doctor,
        "old_date": old_date,
        "old_time": old_time,
        "new_date": new_date,
        "new_time": new_time,
        "message": f"Rescheduled to {new_date} at {new_time}.",
    }


def cancel_appointment(appointment_id: str, db: Session) -> dict:
    """Cancel an active (scheduled or confirmed) appointment."""
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).first()

    if not appt:
        return {"error": f"Appointment '{appointment_id}' not found or already cancelled."}

    appt.status = STATUS_CANCELLED
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"error": "Could not cancel the appointment. Please try again."}

    return {
        "success": True,
        "appointment_id": appointment_id,
        "message": f"Appointment with {appt.doctor} on {appt.date} at {appt.time} has been cancelled.",
    }
