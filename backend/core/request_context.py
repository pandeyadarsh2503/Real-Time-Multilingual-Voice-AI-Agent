"""
Per-request context: a request ID that follows the request through
every log line and is echoed back in the X-Request-ID response header.

Incoming X-Request-ID values are honoured (so a proxy or the frontend
can correlate), otherwise a short uuid is generated. Stored in a
ContextVar, which is task-local — safe under async concurrency.
"""
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_MAX_ID_LEN = 64  # don't let clients stuff arbitrary payloads into logs


def get_request_id() -> str:
    return request_id_var.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = (request.headers.get("X-Request-ID") or "").strip()
        rid = incoming[:_MAX_ID_LEN] if incoming else uuid.uuid4().hex[:16]
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = rid
        return response
