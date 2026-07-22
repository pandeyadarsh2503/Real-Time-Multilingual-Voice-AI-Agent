import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import DOCTOR_HOURS, DOCTOR_NAMES, TIME_SLOTS, clinic_now, clinic_today
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


def _doctor_slots(doctor: str) -> list[str]:
    """Clinic slots that fall inside this doctor's consulting window."""
    start, end = DOCTOR_HOURS[doctor]
    return [s for s in TIME_SLOTS if start <= s < end]


def _suggest_slots(doctor: str, date_str: str, db: Session, limit: int = 3) -> list:
    avail = check_availability(doctor, date_str, db)
    return avail.get("available_slots", [])[:limit]


def _owned_filter(query, patient_uid: Optional[str], patient_name: Optional[str] = None):
    """Restrict to the caller's appointments.

    A row is owned if its uid matches the caller, OR it is a legacy row
    (no uid, booked before auth existed) whose patient_name matches the
    caller's name. The name gate is essential: without it, ANY caller
    could act on ANY uid-less appointment by supplying its id. Mirrors
    routers/appointments._owned_by and list_my_appointments exactly.

    When patient_uid is falsy (AUTH_DISABLED / dev), no scoping is applied.
    """
    if not patient_uid:
        return query
    ownership = [Appointment.patient_uid == patient_uid]
    if patient_name:
        ownership.append(
            Appointment.patient_uid.is_(None) & (Appointment.patient_name == patient_name)
        )
    return query.filter(or_(*ownership))


def check_availability(doctor: str, date_str: str, db: Session) -> dict:
    """Return available slots for a doctor on a given date, within that
    doctor's consulting hours."""
    if doctor not in DOCTOR_NAMES:
        return {
            "error": f"Doctor '{doctor}' not found.",
            "available_doctors": DOCTOR_NAMES,
        }
    appt_date = _parse_date(date_str)
    if appt_date is None:
        return {"error": "Invalid date format. Please use YYYY-MM-DD."}
    date_str = appt_date.isoformat()   # canonicalise (2026-7-5 → 2026-07-05)

    if appt_date < clinic_today():
        return {"error": "Cannot check availability for past dates."}

    booked = db.query(Appointment).filter(
        Appointment.doctor == doctor,
        Appointment.date   == date_str,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).all()
    booked_times = {a.time for a in booked}

    available = [
        slot for slot in _doctor_slots(doctor)
        if slot not in booked_times and not _slot_in_past(appt_date, slot)
    ]

    start, end = DOCTOR_HOURS[doctor]
    return {
        "doctor": doctor,
        "date": date_str,
        "consulting_hours": f"{start}–{end}",
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
    date_str = appt_date.isoformat()   # canonicalise so the unique index & conflict query agree

    if appt_date < clinic_today():
        return {"error": "Cannot book appointments in the past."}

    if time_str not in TIME_SLOTS:
        return {"error": f"'{time_str}' is not a valid slot. Valid slots: {', '.join(TIME_SLOTS)}"}

    if time_str not in _doctor_slots(doctor):
        start, end = DOCTOR_HOURS[doctor]
        return {
            "error": f"{doctor} consults between {start} and {end}. '{time_str}' is outside those hours.",
            "suggested_slots": _suggest_slots(doctor, date_str, db),
        }

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


def list_my_appointments(db: Session, patient_uid: Optional[str], patient_name: Optional[str] = None) -> dict:
    """Active appointments for this patient from today onwards — lets the
    agent resolve 'cancel my appointment with Dr X' without the user
    ever reciting an ID."""
    q = db.query(Appointment).filter(
        Appointment.date >= clinic_today().strftime("%Y-%m-%d"),
        Appointment.status.in_(BLOCKING_STATUSES),
    )
    if patient_uid:
        ownership = [Appointment.patient_uid == patient_uid]
        if patient_name:
            # legacy rows: no uid recorded, matched by name
            ownership.append(
                Appointment.patient_uid.is_(None) & (Appointment.patient_name == patient_name)
            )
        q = q.filter(or_(*ownership))
    elif patient_name:
        q = q.filter(Appointment.patient_name == patient_name)
    else:
        return {"appointments": [], "count": 0}

    rows = q.order_by(Appointment.date, Appointment.time).limit(10).all()
    return {
        "appointments": [
            {
                "appointment_id": a.id,
                "doctor": a.doctor,
                "date": a.date,
                "time": a.time,
                "status": a.status,
            }
            for a in rows
        ],
        "count": len(rows),
    }


def reschedule_appointment(
    appointment_id: str,
    new_date: str,
    new_time: str,
    db: Session,
    patient_uid: Optional[str] = None,
    patient_name: Optional[str] = None,
) -> dict:
    """Move an existing active appointment to a new slot."""
    appt = _owned_filter(
        db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.status.in_(BLOCKING_STATUSES),
        ),
        patient_uid,
        patient_name,
    ).first()

    if not appt:
        return {"error": f"Appointment '{appointment_id}' not found or already cancelled."}

    new_date_obj = _parse_date(new_date)
    if new_date_obj is None:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}
    new_date = new_date_obj.isoformat()   # canonicalise

    if new_date_obj < clinic_today():
        return {"error": "Cannot reschedule to a past date."}

    if new_time not in TIME_SLOTS:
        return {"error": f"'{new_time}' is not a valid slot."}

    if new_time not in _doctor_slots(appt.doctor):
        start, end = DOCTOR_HOURS[appt.doctor]
        return {
            "error": f"{appt.doctor} consults between {start} and {end}. '{new_time}' is outside those hours.",
            "suggested_slots": _suggest_slots(appt.doctor, new_date, db),
        }

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


def cancel_appointment(
    appointment_id: str,
    db: Session,
    patient_uid: Optional[str] = None,
    patient_name: Optional[str] = None,
) -> dict:
    """Cancel an active appointment. When patient_uid is given, only that
    patient's own (or legacy name-matched) appointments can be cancelled."""
    appt = _owned_filter(
        db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.status.in_(BLOCKING_STATUSES),
        ),
        patient_uid,
        patient_name,
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
