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

    id           = Column(String(8), primary_key=True, default=_new_id)
    # Firebase uid of the booking user. Nullable for legacy rows that
    # predate authentication; ownership checks fall back to the name.
    patient_uid  = Column(String(128), index=True)
    patient_name = Column(String(120), nullable=False)
    doctor       = Column(String(120), nullable=False)
    date         = Column(String(10), nullable=False)   # YYYY-MM-DD
    time         = Column(String(5), nullable=False)    # HH:MM (24h)
    status       = Column(String(20), default=STATUS_SCHEDULED, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # ── Race-condition guard ───────────────────────────
        # Partial unique index: at most ONE active (scheduled/confirmed)
        # appointment per doctor + date + time. Cancelled/completed rows
        # are excluded, so re-booking and re-cancelling a slot can never
        # trip the constraint. Enforced natively by both SQLite and
        # PostgreSQL.
        Index(
            "uq_active_slot",
            "doctor", "date", "time",
            unique=True,
            sqlite_where=status.in_(BLOCKING_STATUSES),
            postgresql_where=status.in_(BLOCKING_STATUSES),
        ),
        # Serves check_availability / conflict lookups.
        Index("ix_appt_doctor_date_status", "doctor", "date", "status"),
    )


class Patient(Base):
    __tablename__ = "patients"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    # Firebase uid — the stable identity. Nullable for legacy rows.
    uid                 = Column(String(128), unique=True)
    name                = Column(String(120), unique=True, nullable=False)
    phone               = Column(String(20))
    preferred_doctor    = Column(String(120))
    language            = Column(String(5), default="en")   # en | hi | ta
    last_appointment_id = Column(String(8))
    created_at          = Column(DateTime(timezone=True), server_default=func.now())


class Memory(Base):
    __tablename__ = "memory"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(200), nullable=False)
    role       = Column(String(20), nullable=False)   # user | assistant
    content    = Column(Text, nullable=False)
    timestamp  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # Serves the "newest N turns for a session" restore query.
        Index("ix_memory_session_ts", "session_id", "timestamp"),
    )


class OutboundCampaign(Base):
    __tablename__ = "outbound_campaigns"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(String(8), ForeignKey("appointments.id"))
    phone          = Column(String(20))
    status         = Column(String(20), default="pending")  # pending | confirmed | rescheduled | rejected | failed
    call_sid       = Column(String(64), index=True)
    triggered_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())
