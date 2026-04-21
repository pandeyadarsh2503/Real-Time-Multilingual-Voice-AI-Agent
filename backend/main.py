import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.database import engine
from database.models import Base
from routers import chat, voice, appointments, outbound

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created / verified.")
    yield
    # ── Shutdown ───────────────────────────────────────────
    logger.info("🛑 Server shutting down.")


app = FastAPI(
    title="Healthcare Clinic AI Voice Assistant",
    description=(
        "Real-time multilingual AI voice assistant for clinic appointment management. "
        "Supports English, Hindi, and Tamil."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:3000",   # CRA / alternate
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────
app.include_router(chat.router,         prefix="/api", tags=["Chat"])
app.include_router(voice.router,        prefix="/api", tags=["Voice"])
app.include_router(appointments.router, prefix="/api", tags=["Appointments"])
app.include_router(outbound.router,     prefix="/api", tags=["Outbound"])


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Healthcare Clinic AI Voice Assistant",
        "status":  "running",
        "docs":    "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
