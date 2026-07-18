"""Baseline schema — full SwasthyaAI schema as of the PostgreSQL move.

Creates every table, the uq_active_slot partial unique index (the
double-booking guard), and the query-path indexes. Written to run on
both PostgreSQL (production) and SQLite (CI verification).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-19

"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

_ACTIVE_WHERE = sa.text("status IN ('scheduled', 'confirmed')")


def upgrade() -> None:
    op.create_table(
        "appointments",
        sa.Column("id", sa.String(8), primary_key=True),
        sa.Column("patient_uid", sa.String(128)),
        sa.Column("patient_name", sa.String(120), nullable=False),
        sa.Column("doctor", sa.String(120), nullable=False),
        sa.Column("date", sa.String(10), nullable=False),
        sa.Column("time", sa.String(5), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_appointments_patient_uid", "appointments", ["patient_uid"])
    op.create_index(
        "uq_active_slot",
        "appointments",
        ["doctor", "date", "time"],
        unique=True,
        postgresql_where=_ACTIVE_WHERE,
        sqlite_where=_ACTIVE_WHERE,
    )
    op.create_index(
        "ix_appt_doctor_date_status", "appointments", ["doctor", "date", "status"]
    )

    op.create_table(
        "patients",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("uid", sa.String(128), unique=True),
        sa.Column("name", sa.String(120), unique=True, nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("preferred_doctor", sa.String(120)),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("last_appointment_id", sa.String(8)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "memory",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_memory_session_ts", "memory", ["session_id", "timestamp"])

    op.create_table(
        "outbound_campaigns",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("appointment_id", sa.String(8), sa.ForeignKey("appointments.id")),
        sa.Column("phone", sa.String(20)),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("call_sid", sa.String(64)),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_outbound_campaigns_call_sid", "outbound_campaigns", ["call_sid"])


def downgrade() -> None:
    op.drop_table("outbound_campaigns")
    op.drop_table("memory")
    op.drop_table("patients")
    op.drop_table("appointments")
