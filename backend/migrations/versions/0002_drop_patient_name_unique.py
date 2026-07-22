"""Drop UNIQUE(patients.name) and add a date-scoped appointment index.

Firebase display names are not unique, so UNIQUE(name) let two users with
the same name collide onto one patients row and overwrite each other's
preferred doctor / language (cross-patient PII bleed). Ownership is keyed
on uid; name is now just an indexed lookup column.

Also adds ix_appt_date_status for date-scoped roster scans (upcoming /
today / reminder lists) that filter on date without a doctor.

Revision ID: 0002_drop_patient_name_unique
Revises: 0001_baseline
Create Date: 2026-07-22

"""
import sqlalchemy as sa
from alembic import op

revision = "0002_drop_patient_name_unique"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def _patients_table(meta: sa.MetaData) -> sa.Table:
    """Target patients schema — uid unique, name indexed (not unique)."""
    return sa.Table(
        "patients", meta,
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("uid", sa.String(128), unique=True),
        sa.Column("name", sa.String(120), nullable=False, index=True),
        sa.Column("phone", sa.String(20)),
        sa.Column("preferred_doctor", sa.String(120)),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("last_appointment_id", sa.String(8)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def upgrade() -> None:
    op.create_index("ix_appt_date_status", "appointments", ["date", "status"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # SQLAlchemy auto-names a column-level unique as <table>_<col>_key.
        op.drop_constraint("patients_name_key", "patients", type_="unique")
        op.create_index("ix_patients_name", "patients", ["name"])
    else:
        # SQLite (CI verification): a column-level UNIQUE is unnamed, so
        # rebuild the table from the target definition and copy data.
        with op.batch_alter_table(
            "patients", copy_from=_patients_table(sa.MetaData()), recreate="always"
        ):
            pass


def downgrade() -> None:
    op.drop_index("ix_appt_date_status", "appointments")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index("ix_patients_name", "patients")
        op.create_unique_constraint("patients_name_key", "patients", ["name"])
