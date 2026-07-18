import logging
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

logger = logging.getLogger(__name__)

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL (Neon). pool_pre_ping revalidates connections that the
    # serverless proxy may have closed; modest pool sizes stay well
    # within Neon's free-tier connection limits.
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
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


# ── Schema management ──────────────────────────────────────
# PostgreSQL: Alembic owns the schema (migrations/ is the source of
#             truth); we upgrade to head on startup.
# SQLite:     dev-only. create_all plus the idempotent fixups below,
#             because create_all never alters existing tables.

def _sqlite_fixups(conn):
    tables = {
        r[0] for r in conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
    }

    if "appointments" in tables:
        # Legacy 4-column UNIQUE constraint requires a table rebuild.
        ddl = conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments'"
        )).scalar() or ""
        if "uq_scheduled_slot" in ddl:
            from database import models
            logger.info("Migrating appointments table: dropping legacy uq_scheduled_slot …")
            conn.execute(text("ALTER TABLE appointments RENAME TO appointments_legacy"))
            models.Appointment.__table__.create(conn)
            conn.execute(text(
                "INSERT INTO appointments (id, patient_name, doctor, date, time, status, created_at) "
                "SELECT id, patient_name, doctor, date, time, status, created_at FROM appointments_legacy"
            ))
            conn.execute(text("DROP TABLE appointments_legacy"))

        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(appointments)"))}
        if "patient_uid" not in cols:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN patient_uid VARCHAR(128)"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_appointments_patient_uid "
                "ON appointments (patient_uid)"
            ))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_active_slot "
            "ON appointments (doctor, date, time) "
            "WHERE status IN ('scheduled', 'confirmed')"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_appt_doctor_date_status "
            "ON appointments (doctor, date, status)"
        ))

    if "patients" in tables:
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(patients)"))}
        if "uid" not in cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN uid VARCHAR(128)"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_uid ON patients (uid)"
            ))

    if "memory" in tables:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_memory_session_ts "
            "ON memory (session_id, timestamp)"
        ))


def run_startup_migrations():
    if _is_sqlite:
        with engine.begin() as conn:
            _sqlite_fixups(conn)
        Base.metadata.create_all(bind=engine)
        return

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    logger.info("Running Alembic migrations → head …")
    command.upgrade(cfg, "head")
    logger.info("Database schema is up to date.")
