import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from config import settings

logger = logging.getLogger(__name__)

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_startup_migrations():
    """
    Lightweight, idempotent fixups for existing SQLite dev databases.
    (Proper Alembic migrations arrive with the PostgreSQL move.)

    Rebuilds the appointments table if it still carries the legacy
    `uq_scheduled_slot` UNIQUE(doctor, date, time, status) constraint,
    which made a second cancellation of the same slot crash.
    """
    if not _is_sqlite:
        return

    from database import models  # local import — models imports Base from here

    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments'"
        )).fetchone()

        if row and "uq_scheduled_slot" in (row[0] or ""):
            logger.info("Migrating appointments table: dropping legacy uq_scheduled_slot …")
            conn.execute(text("ALTER TABLE appointments RENAME TO appointments_legacy"))
            models.Appointment.__table__.create(conn)
            conn.execute(text(
                "INSERT INTO appointments (id, patient_name, doctor, date, time, status, created_at) "
                "SELECT id, patient_name, doctor, date, time, status, created_at FROM appointments_legacy"
            ))
            conn.execute(text("DROP TABLE appointments_legacy"))
            logger.info("Appointments table migrated to partial unique index uq_active_slot.")
        elif row:
            # Table exists (create_all will skip it) — make sure the partial
            # unique index is present even on DBs created before this change.
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_active_slot "
                "ON appointments (doctor, date, time) "
                "WHERE status IN ('scheduled', 'confirmed')"
            ))
