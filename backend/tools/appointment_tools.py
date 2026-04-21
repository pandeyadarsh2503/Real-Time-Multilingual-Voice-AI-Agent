from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session
from database.models import Appointment
from config import TIME_SLOTS, DOCTOR_NAMES
import uuid


def check_availability(doctor: str, date_str: str, db: Session) -> dict:
    """Return available 30-min slots for a doctor on a given date."""
    if doctor not in DOCTOR_NAMES:
        return {
            "error": f"Doctor '{doctor}' not found.",
            "available_doctors": DOCTOR_NAMES,
        }
    try:
        appt_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Please use YYYY-MM-DD."}

    today = date.today()
    if appt_date < today:
        return {"error": "Cannot check availability for past dates."}

    booked = db.query(Appointment).filter(
        Appointment.doctor == doctor,
        Appointment.date   == date_str,
        Appointment.status == "scheduled",
    ).all()
    booked_times = {a.time for a in booked}

    now = datetime.now()
    available = []
    for slot in TIME_SLOTS:
        if appt_date == today:
            slot_dt = datetime.combine(today, datetime.strptime(slot, "%H:%M").time())
            if slot_dt <= now:
                continue
        if slot not in booked_times:
            available.append(slot)

    return {
        "doctor": doctor,
        "date": date_str,
        "available_slots": available,
        "total_available": len(available),
    }


def book_appointment(name: str, doctor: str, date_str: str, time_str: str, db: Session) -> dict:
    """Book a slot after validation."""
    if doctor not in DOCTOR_NAMES:
        return {"error": f"Doctor '{doctor}' not found. Available: {', '.join(DOCTOR_NAMES)}"}

    try:
        appt_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}

    today = date.today()
    if appt_date < today:
        return {"error": "Cannot book appointments in the past."}

    if time_str not in TIME_SLOTS:
        return {"error": f"'{time_str}' is not a valid slot. Valid slots: {', '.join(TIME_SLOTS)}"}

    if appt_date == today:
        slot_dt = datetime.combine(today, datetime.strptime(time_str, "%H:%M").time())
        if slot_dt <= datetime.now():
            return {"error": "This time slot has already passed for today."}

    conflict = db.query(Appointment).filter(
        Appointment.doctor == doctor,
        Appointment.date   == date_str,
        Appointment.time   == time_str,
        Appointment.status == "scheduled",
    ).first()

    if conflict:
        avail = check_availability(doctor, date_str, db)
        suggested = avail.get("available_slots", [])[:3]
        return {
            "error": f"Slot {time_str} is already booked for {doctor} on {date_str}.",
            "suggested_slots": suggested,
        }

    appt_id = str(uuid.uuid4())[:8].upper()
    appt = Appointment(
        id=appt_id,
        patient_name=name,
        doctor=doctor,
        date=date_str,
        time=time_str,
        status="scheduled",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return {
        "success": True,
        "appointment_id": appt_id,
        "patient_name": name,
        "doctor": doctor,
        "date": date_str,
        "time": time_str,
        "status": "scheduled",
        "message": f"Appointment booked! ID: {appt_id}",
    }


def reschedule_appointment(appointment_id: str, new_date: str, new_time: str, db: Session) -> dict:
    """Move an existing scheduled appointment to a new slot."""
    appt = db.query(Appointment).filter(
        Appointment.id     == appointment_id,
        Appointment.status == "scheduled",
    ).first()

    if not appt:
        return {"error": f"Appointment '{appointment_id}' not found or already cancelled."}

    try:
        new_date_obj = datetime.strptime(new_date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD."}

    if new_date_obj < date.today():
        return {"error": "Cannot reschedule to a past date."}

    if new_time not in TIME_SLOTS:
        return {"error": f"'{new_time}' is not a valid slot."}

    if new_date_obj == date.today():
        slot_dt = datetime.combine(date.today(), datetime.strptime(new_time, "%H:%M").time())
        if slot_dt <= datetime.now():
            return {"error": "This time slot has already passed for today."}

    conflict = db.query(Appointment).filter(
        Appointment.doctor == appt.doctor,
        Appointment.date   == new_date,
        Appointment.time   == new_time,
        Appointment.status == "scheduled",
        Appointment.id     != appointment_id,
    ).first()

    if conflict:
        avail = check_availability(appt.doctor, new_date, db)
        suggested = avail.get("available_slots", [])[:3]
        return {
            "error": f"Slot {new_time} on {new_date} is already booked.",
            "suggested_slots": suggested,
        }

    old_date, old_time = appt.date, appt.time
    appt.date = new_date
    appt.time = new_time
    db.commit()

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
    """Cancel a scheduled appointment."""
    appt = db.query(Appointment).filter(
        Appointment.id     == appointment_id,
        Appointment.status == "scheduled",
    ).first()

    if not appt:
        return {"error": f"Appointment '{appointment_id}' not found or already cancelled."}

    appt.status = "cancelled"
    db.commit()

    return {
        "success": True,
        "appointment_id": appointment_id,
        "message": f"Appointment with {appt.doctor} on {appt.date} at {appt.time} has been cancelled.",
    }
