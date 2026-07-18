"""
Tests for request IDs, structured logging, metrics exposure, and probes.
"""
import json
import logging
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import settings
from core.logging_config import JsonFormatter, RequestIdFilter
from core.request_context import request_id_var
from main import app


@pytest.fixture()
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_request_id_generated_and_returned(client):
    resp = client.get("/health")
    rid = resp.headers.get("X-Request-ID")
    assert rid and len(rid) == 16


def test_incoming_request_id_is_honoured(client):
    resp = client.get("/health", headers={"X-Request-ID": "trace-abc-123"})
    assert resp.headers["X-Request-ID"] == "trace-abc-123"


def test_oversized_request_id_is_truncated(client):
    resp = client.get("/health", headers={"X-Request-ID": "x" * 500})
    assert len(resp.headers["X-Request-ID"]) == 64


def test_json_formatter_emits_valid_json_with_request_id():
    token = request_id_var.set("req-42")
    try:
        record = logging.LogRecord("t", logging.INFO, "f.py", 1, "hello %s", ("world",), None)
        RequestIdFilter().filter(record)
        payload = json.loads(JsonFormatter().format(record))
    finally:
        request_id_var.reset(token)
    assert payload["message"] == "hello world"
    assert payload["request_id"] == "req-42"
    assert payload["level"] == "INFO"


def test_metrics_endpoint_exposes_prometheus_data(client):
    client.get("/health")  # generate at least one observation
    resp = client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text
    assert "swasthya_llm_request_seconds" in body
    assert "swasthya_agent_tool_calls_total" in body


def test_metrics_token_gates_scrape(client, monkeypatch):
    monkeypatch.setattr(settings, "METRICS_TOKEN", "scrape-secret")
    assert client.get("/metrics").status_code == 403
    ok = client.get("/metrics", headers={"Authorization": "Bearer scrape-secret"})
    assert ok.status_code == 200


def test_liveness_has_no_dependency_checks(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "healthy"}


def test_readiness_reports_database(client):
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"


def test_readiness_fails_when_db_down(client, monkeypatch):
    import database.database as dbmod

    class BrokenEngine:
        def connect(self):
            raise RuntimeError("db down")

    monkeypatch.setattr(dbmod, "engine", BrokenEngine())
    resp = client.get("/health/ready")
    assert resp.status_code == 503
    assert resp.json()["checks"]["database"] == "error"
