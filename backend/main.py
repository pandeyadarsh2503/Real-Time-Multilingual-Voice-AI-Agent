import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
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
    yield
    # ── Shutdown ───────────────────────────────────────────
    logger.info("🛑 Server shutting down.")


app = FastAPI(
    title="SwasthyaAI — Healthcare Voice Assistant",
    description=(
        "Real-time multilingual AI voice assistant for clinic appointment management. "
        "Supports English, Hindi, and Tamil."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

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
from routers import chat, voice, appointments, outbound  # noqa: E402

app.include_router(chat.router,         prefix="/api", tags=["Chat"])
app.include_router(voice.router,        prefix="/api", tags=["Voice"])
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
        if auth != f"Bearer {settings.METRICS_TOKEN}":
            return Response(status_code=403)
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
