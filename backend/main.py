import hmac
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from config import settings
from core.logging_config import setup_logging
from core.rate_limit import limiter
from core.request_context import RequestIdMiddleware
from core.tracing import init_tracing
from database.database import run_startup_migrations

setup_logging(settings.LOG_FORMAT)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────
    run_startup_migrations()
    logger.info("✅ Database schema created / verified.")
    try:
        from database.database import SessionLocal
        from services.memory_service import prune_old_memory
        with SessionLocal() as db:
            deleted = prune_old_memory(db)
        if deleted:
            logger.info(f"🧹 Pruned {deleted} persisted memory rows past retention.")
    except Exception:
        logger.exception("Memory retention pruning failed (non-fatal).")
    if settings.AUTH_DISABLED:
        logger.warning("⚠️  AUTH_DISABLED=true — API is running WITHOUT authentication.")
    elif not settings.FIREBASE_PROJECT_ID:
        logger.warning("⚠️  FIREBASE_PROJECT_ID is not set — authenticated endpoints will return 503.")

    # Warm the Whisper model off the critical path so the first live
    # utterance pays inference cost only, never model loading.
    import asyncio as _asyncio

    from services.stt_service import warm_up
    _asyncio.get_event_loop().run_in_executor(None, warm_up)

    # Enforce transcript retention continuously, not just at boot — a
    # long-lived process would otherwise keep PHI past the retention window.
    prune_task = _asyncio.create_task(_periodic_prune())
    yield
    # ── Shutdown ───────────────────────────────────────────
    prune_task.cancel()
    logger.info("🛑 Server shutting down.")


async def _periodic_prune():
    import asyncio as _asyncio

    from database.database import SessionLocal
    from services.memory_service import prune_old_memory
    while True:
        try:
            await _asyncio.sleep(24 * 3600)
            with SessionLocal() as db:
                deleted = prune_old_memory(db)
            if deleted:
                logger.info(f"🧹 Periodic prune removed {deleted} expired memory rows.")
        except _asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Periodic memory prune failed (non-fatal).")


# In production, don't publish the interactive docs / OpenAPI schema —
# they map the entire API surface for an attacker. Enabled in dev/staging.
_docs_on = not settings.is_production

app = FastAPI(
    title="SwasthyaAI — Healthcare Voice Assistant",
    description=(
        "Real-time multilingual AI voice assistant for clinic appointment management. "
        "Supports English, Hindi, and Tamil."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

# Paths allowed to send large (audio) bodies; everything else is capped
# so an unauthenticated client can't push a multi-MB body the server
# buffers before auth/validation rejects it.
_LARGE_BODY_PATHS = ("/api/voice/stt",)
_MAX_AUDIO_BYTES = 12 * 1024 * 1024


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl is not None:
        try:
            size = int(cl)
        except ValueError:
            size = 0
        limit = _MAX_AUDIO_BYTES if request.url.path in _LARGE_BODY_PATHS else settings.MAX_REQUEST_BYTES
        if size > limit:
            return JSONResponse(status_code=413, content={"detail": "Request body too large."})
    return await call_next(request)

# ── Rate limiting (Redis-backed when configured) ───────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS (comma-separated origins from env) ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_QUIET_PATHS = ("/health", "/health/ready", "/metrics")
access_logger = logging.getLogger("access")


# ── Access log + security headers ──────────────────────────
@app.middleware("http")
async def access_log_and_security_headers(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)

    if request.url.path not in _QUIET_PATHS:
        access_logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else "-",
            },
        )

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), geolocation=(), payment=()"
    )
    return response


# Outermost middleware: everything inside sees the request ID.
app.add_middleware(RequestIdMiddleware)

# ── HTTP metrics (per-handler latency histograms) ──────────
Instrumentator(excluded_handlers=["/metrics", "/health.*"]).instrument(app)

# ── Tracing (no-op unless OTLP endpoint configured) ────────
init_tracing(app)

# ── Routers ────────────────────────────────────────────────
from routers import appointments, chat, outbound, rtc, voice  # noqa: E402

app.include_router(chat.router,         prefix="/api", tags=["Chat"])
app.include_router(voice.router,        prefix="/api", tags=["Voice"])
app.include_router(rtc.router,          prefix="/api", tags=["Live Voice"])
app.include_router(appointments.router, prefix="/api", tags=["Appointments"])
app.include_router(outbound.router,     prefix="/api", tags=["Outbound"])


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "SwasthyaAI — Healthcare Voice Assistant",
        "status":  "running",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    """Liveness: the process is up. No dependency checks — a wedged
    dependency must not get the container restarted."""
    return {"status": "healthy"}


@app.get("/health/ready", tags=["Health"])
def readiness():
    """Readiness: can this instance actually serve? Checks the DB and,
    when configured, Redis. 503 tells the platform to hold traffic."""
    from database.database import engine

    checks = {}
    healthy = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logging.getLogger(__name__).error(f"Readiness DB check failed: {exc}")
        checks["database"] = "error"
        healthy = False

    if settings.REDIS_URL:
        try:
            import redis as redis_sync
            r = redis_sync.from_url(settings.REDIS_URL, socket_connect_timeout=2)
            r.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            logging.getLogger(__name__).error(f"Readiness Redis check failed: {exc}")
            checks["redis"] = "error"
            healthy = False

    return Response(
        content=json.dumps({"status": "ready" if healthy else "not_ready", "checks": checks}),
        media_type="application/json",
        status_code=200 if healthy else 503,
    )


@app.get("/metrics", include_in_schema=False)
def metrics(request: Request):
    """Prometheus scrape target. Optionally protected by METRICS_TOKEN."""
    if settings.METRICS_TOKEN:
        auth = request.headers.get("Authorization", "")
        if not hmac.compare_digest(auth, f"Bearer {settings.METRICS_TOKEN}"):
            return Response(status_code=403)
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
