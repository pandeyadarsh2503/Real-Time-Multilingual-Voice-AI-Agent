import uuid
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from .database import Base


def _new_id():
    return str(uuid.uuid4())[:8].upper()


class Appointment(Base):
    __tablename__ = "appointments"

    id           = Column(String, primary_key=True, default=_new_id)
    patient_name = Column(String, nullable=False)
    doctor       = Column(String, nullable=False)
    date         = Column(String, nullable=False)   # YYYY-MM-DD
    time         = Column(String, nullable=False)   # HH:MM (24h)
    status       = Column(String, default="scheduled")  # scheduled | cancelled | completed
    created_at   = Column(DateTime, server_default=func.now())


class Patient(Base):
    __tablename__ = "patients"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    name                = Column(String, unique=True, nullable=False)
    phone               = Column(String)
    preferred_doctor    = Column(String)
    language            = Column(String, default="en")   # en | hi | ta
    last_appointment_id = Column(String)
    created_at          = Column(DateTime, server_default=func.now())


class Memory(Base):
    __tablename__ = "memory"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False, index=True)
    role       = Column(String, nullable=False)   # user | assistant
    content    = Column(Text, nullable=False)
    timestamp  = Column(DateTime, server_default=func.now())


class OutboundCampaign(Base):
    __tablename__ = "outbound_campaigns"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(String, ForeignKey("appointments.id"))
    phone          = Column(String)
    status         = Column(String, default="pending")  # pending | confirmed | rescheduled | rejected | failed
    call_sid       = Column(String)
    triggered_at   = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, onupdate=func.now())
