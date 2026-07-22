"""
API tests for authentication and role-based access control.

Uses FastAPI dependency overrides — no live Firebase needed.
TestClient is used without a context manager so the app's lifespan
(and its dev-database migrations) never runs against real files.
"""
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import clinic_today
from database.database import Base, get_db
from database.models import Appointment
from main import app
from services.auth_service import get_current_user

FUTURE = (clinic_today() + timedelta(days=5)).strftime("%Y-%m-%d")
TOMORROW = (clinic_today() + timedelta(days=1)).strftime("%Y-%m-%d")

PATIENT_ASHA = {"uid": "uid-asha", "name": "Asha", "email": "asha@x.com", "role": "patient"}
PATIENT_RAVI = {"uid": "uid-ravi", "name": "Ravi", "email": "ravi@x.com", "role": "patient"}
DOCTOR_USER  = {"uid": "uid-doc",  "name": "Dr Ananya Iyer", "email": "doc@x.com", "role": "doctor"}


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    seed = TestSession()
    seed.add_all([
        # Legacy rows (no uid) — ownership falls back to name matching.
        Appointment(id="ASHA0001", patient_name="Asha", doctor="Dr Ananya Iyer",
                    date=FUTURE, time="10:00", status="scheduled"),
        Appointment(id="RAVI0001", patient_name="Ravi", doctor="Dr Ananya Iyer",
                    date=FUTURE, time="10:30", status="scheduled"),
        # uid-linked row booked under a different display name — uid wins.
        Appointment(id="ASHA0002", patient_uid="uid-asha", patient_name="A. Sharma",
                    doctor="Dr Ananya Iyer", date=FUTURE, time="11:00", status="scheduled"),
        # Tomorrow rows — reminder-candidate scoping.
        Appointment(id="ASHATOM1", patient_uid="uid-asha", patient_name="Asha",
                    doctor="Dr Ananya Iyer", date=TOMORROW, time="09:00", status="scheduled"),
        Appointment(id="RAVITOM1", patient_uid="uid-ravi", patient_name="Ravi",
                    doctor="Dr Ananya Iyer", date=TOMORROW, time="09:30", status="scheduled"),
    ])
    seed.commit()
    seed.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


def login_as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_unauthenticated_requests_are_rejected(client):
    assert client.get("/api/appointments").status_code in (401, 503)
    assert client.get("/api/doctors").status_code in (401, 503)
    assert client.post("/api/chat", json={"message": "hi", "session_id": "s1"}).status_code in (401, 503)
    assert client.post("/api/voice/tts", json={"text": "hi"}).status_code in (401, 503)
    assert client.post("/api/voice/rtc/offer", json={"sdp": "v=0", "type": "offer"}).status_code in (401, 503)
    assert client.delete("/api/appointments/ASHA0001").status_code in (401, 503)


def test_health_endpoints_are_public(client):
    assert client.get("/health").status_code == 200
    assert client.get("/").status_code == 200


def test_patient_sees_only_own_appointments(client):
    login_as(PATIENT_ASHA)
    rows = client.get("/api/appointments").json()
    # Legacy row matched by name + uid-linked rows matched by uid.
    assert {r["id"] for r in rows} == {"ASHA0001", "ASHA0002", "ASHATOM1"}

    # filter injection attempt is ignored for patients
    rows = client.get("/api/appointments", params={"patient_name": "Ravi"}).json()
    assert {r["id"] for r in rows} == {"ASHA0001", "ASHA0002", "ASHATOM1"}


def test_uid_ownership_beats_name(client):
    # Ravi cannot see or cancel Asha's uid-linked appointment even
    # though its display name differs from Asha's.
    login_as(PATIENT_RAVI)
    assert client.get("/api/appointments/ASHA0002").status_code == 404
    assert client.delete("/api/appointments/ASHA0002").status_code == 404
    login_as(PATIENT_ASHA)
    assert client.get("/api/appointments/ASHA0002").status_code == 200
    assert client.delete("/api/appointments/ASHA0002").status_code == 200


def test_doctor_sees_all_appointments(client):
    login_as(DOCTOR_USER)
    rows = client.get("/api/appointments").json()
    assert {r["id"] for r in rows} == {"ASHA0001", "RAVI0001", "ASHA0002", "ASHATOM1", "RAVITOM1"}


def test_patient_cannot_cancel_someone_elses_appointment(client):
    login_as(PATIENT_ASHA)
    assert client.delete("/api/appointments/RAVI0001").status_code == 404
    assert client.delete("/api/appointments/ASHA0001").status_code == 200


def test_patient_cannot_read_someone_elses_appointment(client):
    login_as(PATIENT_RAVI)
    assert client.get("/api/appointments/ASHA0001").status_code == 404
    assert client.get("/api/appointments/RAVI0001").status_code == 200


def test_today_view_requires_doctor_role(client):
    login_as(PATIENT_ASHA)
    assert client.get("/api/appointments/today").status_code == 403
    login_as(DOCTOR_USER)
    assert client.get("/api/appointments/today").status_code == 200


def test_webhook_requires_shared_token(client):
    resp = client.post("/api/outbound/webhook", data={"CallSid": "x"})
    assert resp.status_code == 403


def test_outbound_call_and_staff_endpoints_reject_patients(client):
    """A patient must not reach the call-initiating or cross-patient
    staff endpoints on the outbound router (toll-fraud / IDOR guard)."""
    login_as(PATIENT_ASHA)
    assert client.post("/api/outbound/trigger",
                       json={"appointment_id": "ASHA0001", "phone": "+919876543210"}).status_code == 403
    assert client.post("/api/outbound/simulate",
                       json={"appointment_id": "RAVI0001"}).status_code == 403
    assert client.post("/api/outbound/generate-message",
                       json={"name": "Asha", "doctor": "Dr Ananya Iyer", "date": FUTURE,
                             "time": "10:00", "purpose": "reminder"}).status_code == 403
    # The IDOR that used to let any patient confirm any appointment.
    assert client.post("/api/outbound/respond",
                       json={"appointment_id": "RAVI0001", "response": "confirm"}).status_code == 403
    # Doctor/admin reaches the same route (no network on this branch).
    login_as(DOCTOR_USER)
    assert client.post("/api/outbound/respond",
                       json={"appointment_id": "RAVI0001", "response": "confirm"}).status_code == 200


def test_trigger_demo_success_path_does_not_500(client):
    """Regression: @limiter.limit on trigger-demo needs a `response: Response`
    param, or a SUCCESSFUL call 500s when slowapi injects rate-limit headers."""
    login_as(PATIENT_ASHA)
    resp = client.post("/api/outbound/trigger-demo", json={
        "phone": "+919876543210", "patient_name": "Asha", "doctor": "Dr Ananya Iyer",
        "date": FUTURE, "time": "10:00", "delay_minutes": 5,
    })
    assert resp.status_code == 200, resp.text
    assert resp.json().get("success") is True
    assert "x-ratelimit-limit" in {k.lower() for k in resp.headers}


def test_upcoming_reminders_scoped_to_caller(client):
    """A patient sees only their own tomorrow appointments; the full
    roster is doctor/admin only (was a plaintext PHI dump to any caller)."""
    login_as(PATIENT_ASHA)
    ids = {r["appointment_id"] for r in client.get("/api/outbound/upcoming-reminders").json()}
    assert ids == {"ASHATOM1"}
    login_as(DOCTOR_USER)
    ids = {r["appointment_id"] for r in client.get("/api/outbound/upcoming-reminders").json()}
    assert {"ASHATOM1", "RAVITOM1"} <= ids


def test_authorized_chat_success_path_with_rate_limit_headers(client, monkeypatch):
    """
    Regression: rate-limited endpoints returning Pydantic models used to
    crash on SUCCESSFUL calls because slowapi had no Response object to
    inject its headers into (only 401/429 paths had been exercised).
    """
    import services.agent_runtime as agent_runtime

    async def fake_agent(messages, tool_executor, max_iter=6, reply_language=None):
        return "Hello! How can I help?", messages + [
            {"role": "assistant", "content": "Hello! How can I help?"}
        ]

    monkeypatch.setattr(agent_runtime, "run_agent", fake_agent)
    login_as(PATIENT_ASHA)
    resp = client.post("/api/chat", json={"message": "hi", "session_id": "s-reg"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["response"] == "Hello! How can I help?"
    assert "x-ratelimit-limit" in {k.lower() for k in resp.headers}
