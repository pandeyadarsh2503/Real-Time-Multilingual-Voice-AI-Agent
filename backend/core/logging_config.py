"""
Logging setup.

LOG_FORMAT=text → human-readable lines for local development.
LOG_FORMAT=json → one JSON object per line (machine-parseable, what
                  Grafana Loki / any log aggregator expects).

Every record carries the current request ID via a logging.Filter, so a
single grep ties together everything one request did.
"""
import json
import logging
from datetime import datetime, timezone

from core.request_context import get_request_id


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # structured extras (logger.info("x", extra={"foo": 1}))
        for key, value in record.__dict__.items():
            if key in ("duration_ms", "status_code", "method", "path", "client_ip"):
                payload[key] = value
        return json.dumps(payload, ensure_ascii=False)


def setup_logging(fmt: str = "text"):
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()

    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s [%(request_id)s] — %(message)s"
        ))
    root.addHandler(handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # our access log replaces it
