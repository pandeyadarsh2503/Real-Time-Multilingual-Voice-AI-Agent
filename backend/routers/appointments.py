from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import DOCTORS, clinic_today
from database.database import get_db
from database.models import BLOCKING_STATUSES, STATUS_CANCELLED, Appointment
from services.auth_service import ROLE_DOCTOR, ROLE_PATIENT, get_current_user, require_role

router = APIRouter()


def _own_name(user: dict) -> str:
    return user["name"] or user["email"]


def _owned_by(user: dict):
    """Filter: rows belonging to this user — uid match, or legacy rows
    (booked before auth existed) matched by name."""
    return or_(
        Appointment.patient_uid == user["uid"],
        Appointment.patient_uid.is_(None) & (Appointment.patient_name == _own_name(user)),
    )


def _is_owner(a: Appointment, user: dict) -> bool:
    if a.patient_uid:
        return a.patient_uid == user["uid"]
    return a.patient_name == _own_name(user)


class AppointmentOut(BaseModel):
    id: str
    patient_name: str
    doctor: str
    date: str
    time: str
    status: str

    model_config = ConfigDict(from_attributes=True)


@router.get("/appointments", response_model=List[AppointmentOut])
def list_appointments(
    doctor: Optional[str] = None,
    patient_name: Optional[str] = None,
    date_filter: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    q = db.query(Appointment)
    # Patients only ever see their own bookings, regardless of the
    # filter they send; doctors/admins may query freely.
    if user["role"] == ROLE_PATIENT:
        q = q.filter(_owned_by(user))
    elif patient_name:
        q = q.filter(Appointment.patient_name == patient_name)
    if doctor:
        q = q.filter(Appointment.doctor == doctor)
    if date_filter:
        q = q.filter(Appointment.date == date_filter)
    if status:
        q = q.filter(Appointment.status == status)
    return q.order_by(Appointment.date, Appointment.time).all()


@router.get("/appointments/today", dependencies=[Depends(require_role(ROLE_DOCTOR))])
def today_appointments(db: Session = Depends(get_db)):
    """Grouped by doctor — used by the frontend sidebar."""
    today_str = clinic_today().strftime("%Y-%m-%d")
    rows = (
        db.query(Appointment)
        .filter(Appointment.date == today_str, Appointment.status.in_(BLOCKING_STATUSES))
        .order_by(Appointment.time)
        .all()
    )
    grouped: dict = {}
    for a in rows:
        grouped.setdefault(a.doctor, []).append(
            {"id": a.id, "patient_name": a.patient_name, "time": a.time}
        )
    return grouped


@router.get("/appointments/upcoming")
def upcoming_appointments(
    limit: int = Query(5, ge=1, le=50),
    patient_name: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Next N active appointments from today onwards."""
    today_str = clinic_today().strftime("%Y-%m-%d")
    q = db.query(Appointment).filter(
        Appointment.date >= today_str,
        Appointment.status.in_(BLOCKING_STATUSES),
    )
    if user["role"] == ROLE_PATIENT:
        q = q.filter(_owned_by(user))
    elif patient_name:
        q = q.filter(Appointment.patient_name == patient_name)

    rows = q.order_by(Appointment.date, Appointment.time).limit(limit).all()
    return rows


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a or (user["role"] == ROLE_PATIENT and not _is_owner(a, user)):
        # 404 (not 403) so appointment IDs can't be enumerated
        raise HTTPException(status_code=404, detail="Appointment not found")
    return a


@router.delete("/appointments/{appointment_id}")
def cancel_appointment_endpoint(
    appointment_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    a = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.status.in_(BLOCKING_STATUSES),
    ).first()
    if not a or (user["role"] == ROLE_PATIENT and not _is_owner(a, user)):
        raise HTTPException(status_code=404, detail="Appointment not found or already cancelled")
    a.status = STATUS_CANCELLED
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not cancel the appointment.") from None
    return {"message": f"Appointment {appointment_id} cancelled."}


@router.get("/doctors", dependencies=[Depends(get_current_user)])
def list_doctors():
    """Return list of available doctors from config."""
    return DOCTORS
