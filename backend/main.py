import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from core.rate_limit import limiter
from database.database import run_startup_migrations
from routers import chat, voice, appointments, outbound

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────
    run_startup_migrations()
    logger.info("✅ Database schema created / verified.")
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

# ── Rate limiting (in-process, per client IP) ──────────────
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


# ── Security headers ───────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), geolocation=(), payment=()"
    )
    return response


# ── Routers ────────────────────────────────────────────────
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
    return {"status": "healthy"}
