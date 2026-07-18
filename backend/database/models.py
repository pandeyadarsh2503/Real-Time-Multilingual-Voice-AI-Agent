import uuid
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.sql import func
from .database import Base


def _new_id():
    return str(uuid.uuid4())[:8].upper()


# ── Appointment status lifecycle ───────────────────────────
STATUS_SCHEDULED = "scheduled"
STATUS_CONFIRMED = "confirmed"   # patient confirmed via outbound call
STATUS_CANCELLED = "cancelled"
STATUS_COMPLETED = "completed"

# Statuses that occupy a slot. Every availability / conflict query
# must use this set — a confirmed appointment still blocks its slot.
BLOCKING_STATUSES = (STATUS_SCHEDULED, STATUS_CONFIRMED)


class Appointment(Base):
    __tablename__ = "appointments"

    id           = Column(String, primary_key=True, default=_new_id)
    patient_name = Column(String, nullable=False)
    doctor       = Column(String, nullable=False)
    date         = Column(String, nullable=False)   # YYYY-MM-DD
    time         = Column(String, nullable=False)   # HH:MM (24h)
    status       = Column(String, default=STATUS_SCHEDULED)
    created_at   = Column(DateTime, server_default=func.now())

    # ── Race-condition guard ───────────────────────────────
    # Partial unique index: at most ONE active (scheduled/confirmed)
    # appointment per doctor + date + time. Cancelled/completed rows
    # are excluded, so re-booking and re-cancelling a slot can never
    # trip the constraint (the old 4-column UNIQUE that included
    # `status` made the *second* cancellation of a slot crash).
    __table_args__ = (
        Index(
            "uq_active_slot",
            "doctor", "date", "time",
            unique=True,
            sqlite_where=status.in_(BLOCKING_STATUSES),
            postgresql_where=status.in_(BLOCKING_STATUSES),
        ),
    )


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
