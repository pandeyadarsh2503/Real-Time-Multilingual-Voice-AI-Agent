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
        Appointment(id="ASHA0001", patient_name="Asha", doctor="Dr Ananya Iyer",
                    date=FUTURE, time="10:00", status="scheduled"),
        Appointment(id="RAVI0001", patient_name="Ravi", doctor="Dr Ananya Iyer",
                    date=FUTURE, time="10:30", status="scheduled"),
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
    assert client.delete("/api/appointments/ASHA0001").status_code in (401, 503)


def test_health_endpoints_are_public(client):
    assert client.get("/health").status_code == 200
    assert client.get("/").status_code == 200


def test_patient_sees_only_own_appointments(client):
    login_as(PATIENT_ASHA)
    rows = client.get("/api/appointments").json()
    assert [r["id"] for r in rows] == ["ASHA0001"]

    # filter injection attempt is ignored for patients
    rows = client.get("/api/appointments", params={"patient_name": "Ravi"}).json()
    assert [r["id"] for r in rows] == ["ASHA0001"]


def test_doctor_sees_all_appointments(client):
    login_as(DOCTOR_USER)
    rows = client.get("/api/appointments").json()
    assert {r["id"] for r in rows} == {"ASHA0001", "RAVI0001"}


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
