"""
Regression tests for the appointment engine.

Covers the two critical audit findings:
  1. cancel → rebook → cancel again must not crash (legacy 4-column
     UNIQUE constraint included `status` and blew up on the 2nd cancel)
  2. a *confirmed* appointment must still block its slot
"""
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import DOCTOR_HOURS, DOCTOR_NAMES, TIME_SLOTS, clinic_today
from database.database import Base
from database.models import STATUS_CANCELLED, STATUS_CONFIRMED, Appointment
from tools.appointment_tools import (
    book_appointment,
    cancel_appointment,
    check_availability,
    list_my_appointments,
    reschedule_appointment,
)

DOCTOR = DOCTOR_NAMES[0]
FUTURE = (clinic_today() + timedelta(days=7)).strftime("%Y-%m-%d")
FUTURE2 = (clinic_today() + timedelta(days=8)).strftime("%Y-%m-%d")
PAST = (clinic_today() - timedelta(days=1)).strftime("%Y-%m-%d")


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")  # fresh in-memory DB per test
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_book_success(db):
    result = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    assert result["success"] is True
    assert len(result["appointment_id"]) == 8


def test_double_booking_rejected_with_suggestions(db):
    book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    result = book_appointment("Ravi", DOCTOR, FUTURE, "10:00", db)
    assert "error" in result
    assert "10:00" not in result["suggested_slots"]
    assert 1 <= len(result["suggested_slots"]) <= 3


def test_cancel_rebook_cancel_does_not_crash(db):
    """Audit bug #1: the second cancellation used to raise IntegrityError."""
    first = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    assert cancel_appointment(first["appointment_id"], db)["success"] is True

    second = book_appointment("Ravi", DOCTOR, FUTURE, "10:00", db)
    assert second["success"] is True

    result = cancel_appointment(second["appointment_id"], db)
    assert result["success"] is True
    statuses = [a.status for a in db.query(Appointment).all()]
    assert statuses == [STATUS_CANCELLED, STATUS_CANCELLED]


def test_confirmed_appointment_still_blocks_slot(db):
    """Audit bug #2: confirmed slots used to reappear as available."""
    booked = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    appt = db.get(Appointment, booked["appointment_id"])
    appt.status = STATUS_CONFIRMED
    db.commit()

    avail = check_availability(DOCTOR, FUTURE, db)
    assert "10:00" not in avail["available_slots"]

    result = book_appointment("Ravi", DOCTOR, FUTURE, "10:00", db)
    assert "error" in result


def test_cancelled_slot_becomes_available_again(db):
    booked = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    cancel_appointment(booked["appointment_id"], db)
    avail = check_availability(DOCTOR, FUTURE, db)
    assert "10:00" in avail["available_slots"]


def test_validation_rejects_bad_input(db):
    assert "error" in book_appointment("Asha", "Dr Nobody", FUTURE, "10:00", db)
    assert "error" in book_appointment("Asha", DOCTOR, "18-05-2026", "10:00", db)
    assert "error" in book_appointment("Asha", DOCTOR, PAST, "10:00", db)
    assert "error" in book_appointment("Asha", DOCTOR, FUTURE, "10:15", db)
    assert "error" in check_availability(DOCTOR, PAST, db)


def test_reschedule_conflict_and_success(db):
    a = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    book_appointment("Ravi", DOCTOR, FUTURE, "10:30", db)

    conflict = reschedule_appointment(a["appointment_id"], FUTURE, "10:30", db)
    assert "error" in conflict

    moved = reschedule_appointment(a["appointment_id"], FUTURE2, "11:00", db)
    assert moved["success"] is True
    assert "10:00" in check_availability(DOCTOR, FUTURE, db)["available_slots"]


def test_cancel_unknown_id_returns_error(db):
    assert "error" in cancel_appointment("NOPE1234", db)


def test_full_day_has_all_doctor_slots(db):
    """An empty day offers every slot inside the doctor's own hours."""
    start, end = DOCTOR_HOURS[DOCTOR]
    expected = [s for s in TIME_SLOTS if start <= s < end]
    avail = check_availability(DOCTOR, FUTURE, db)
    assert avail["available_slots"] == expected
    assert avail["consulting_hours"] == f"{start}–{end}"


# ── Doctor working hours (Phase 7) ─────────────────────────

def test_booking_outside_doctor_hours_rejected(db):
    # Dr Rajesh Sharma consults 09:00 AM – 01:00 PM
    assert DOCTOR_HOURS[DOCTOR] == ("09:00", "13:00")
    result = book_appointment("Asha", DOCTOR, FUTURE, "14:00", db)
    assert "error" in result and "consults between" in result["error"]
    # in-hours booking still fine
    assert book_appointment("Asha", DOCTOR, FUTURE, "12:30", db)["success"]


def test_reschedule_outside_doctor_hours_rejected(db):
    a = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)
    moved = reschedule_appointment(a["appointment_id"], FUTURE, "16:00", db)
    assert "error" in moved and "consults between" in moved["error"]


def test_availability_never_offers_out_of_hours_slots(db):
    avail = check_availability(DOCTOR, FUTURE, db)
    assert "14:00" not in avail["available_slots"]
    assert all(s < "13:00" for s in avail["available_slots"])


# ── list_my_appointments + ownership (Phase 7) ─────────────

def test_list_my_appointments_scopes_to_owner(db):
    book_appointment("Asha", DOCTOR, FUTURE, "10:00", db, patient_uid="uid-asha")
    book_appointment("Ravi", DOCTOR, FUTURE, "10:30", db, patient_uid="uid-ravi")

    mine = list_my_appointments(db, patient_uid="uid-asha", patient_name="Asha")
    assert mine["count"] == 1
    assert mine["appointments"][0]["time"] == "10:00"


def test_list_my_appointments_includes_legacy_name_rows(db):
    book_appointment("Asha", DOCTOR, FUTURE, "10:00", db)  # no uid (legacy)
    book_appointment("Asha", DOCTOR, FUTURE, "10:30", db, patient_uid="uid-asha")
    mine = list_my_appointments(db, patient_uid="uid-asha", patient_name="Asha")
    assert mine["count"] == 2


def test_cancel_respects_ownership(db):
    a = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db, patient_uid="uid-asha")
    # someone else's uid cannot cancel it
    result = cancel_appointment(a["appointment_id"], db, patient_uid="uid-mallory")
    assert "error" in result
    # the owner can
    assert cancel_appointment(a["appointment_id"], db, patient_uid="uid-asha")["success"]


def test_reschedule_respects_ownership(db):
    a = book_appointment("Asha", DOCTOR, FUTURE, "10:00", db, patient_uid="uid-asha")
    stolen = reschedule_appointment(a["appointment_id"], FUTURE2, "11:00", db, patient_uid="uid-mallory")
    assert "error" in stolen
    moved = reschedule_appointment(a["appointment_id"], FUTURE2, "11:00", db, patient_uid="uid-asha")
    assert moved["success"]
