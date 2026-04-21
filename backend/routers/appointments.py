from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from database.database import get_db
from database.models import Appointment
from config import DOCTORS

router = APIRouter()


class AppointmentOut(BaseModel):
    id: str
    patient_name: str
    doctor: str
    date: str
    time: str
    status: str

    class Config:
        from_attributes = True


@router.get("/appointments", response_model=List[AppointmentOut])
def list_appointments(
    doctor: Optional[str] = None,
    patient_name: Optional[str] = None,
    date_filter: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Appointment)
    if doctor:
        q = q.filter(Appointment.doctor == doctor)
    if patient_name:
        q = q.filter(Appointment.patient_name == patient_name)
    if date_filter:
        q = q.filter(Appointment.date == date_filter)
    if status:
        q = q.filter(Appointment.status == status)
    return q.order_by(Appointment.date, Appointment.time).all()


@router.get("/appointments/today")
def today_appointments(db: Session = Depends(get_db)):
    """Grouped by doctor — used by the frontend sidebar."""
    today_str = date.today().strftime("%Y-%m-%d")
    rows = (
        db.query(Appointment)
        .filter(Appointment.date == today_str, Appointment.status == "scheduled")
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
def upcoming_appointments(limit: int = 5, patient_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Next N scheduled appointments from today onwards."""
    today_str = date.today().strftime("%Y-%m-%d")
    q = db.query(Appointment).filter(
        Appointment.date >= today_str, 
        Appointment.status == "scheduled"
    )
    if patient_name:
        q = q.filter(Appointment.patient_name == patient_name)
        
    rows = q.order_by(Appointment.date, Appointment.time).limit(limit).all()
    return rows


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: str, db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return a


@router.delete("/appointments/{appointment_id}")
def cancel_appointment_endpoint(appointment_id: str, db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    a.status = "cancelled"
    db.commit()
    return {"message": f"Appointment {appointment_id} cancelled."}


@router.get("/doctors")
def list_doctors():
    """Return list of available doctors from config."""
    return DOCTORS
