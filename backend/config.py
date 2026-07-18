from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    AZURE_TTS_KEY: str = ""
    AZURE_TTS_REGION: str = "eastus"
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_TOKEN: str = ""
    EXOTEL_SID: str = ""
    EXOTEL_CALLER_ID: str = ""
    DATABASE_URL: str = "sqlite:///./swasthya.db"
    TTS_PROVIDER: str = "azure"
    CLINIC_TIMEZONE: str = "Asia/Kolkata"

    # ── Observability ─────────────────────────────────────
    LOG_FORMAT: str = "text"             # "text" for dev, "json" for production
    METRICS_TOKEN: str = ""              # optional bearer token protecting /metrics
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""  # e.g. Grafana Cloud OTLP gateway; empty = tracing off
    OTEL_EXPORTER_OTLP_HEADERS: str = ""   # e.g. Authorization=Basic <base64 instance:token>
    OTEL_SERVICE_NAME: str = "swasthyaai-backend"

    # ── Memory / Redis ────────────────────────────────────
    REDIS_URL: str = ""                  # e.g. rediss://default:<pass>@<host>:6379 (Upstash)
    SESSION_TTL_SECONDS: int = 1800      # sliding TTL for live conversations
    MEMORY_RETENTION_DAYS: int = 30      # persisted transcript retention

    # ── Auth & security ───────────────────────────────────
    FIREBASE_PROJECT_ID: str = ""
    AUTH_DISABLED: bool = False          # dev/CI escape hatch — never enable in production
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    EXOTEL_WEBHOOK_TOKEN: str = ""       # shared secret appended to the webhook URL
    EXOTEL_STATUS_CALLBACK_URL: str = "" # public URL Exotel posts call status to

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# ─── Clinic clock ─────────────────────────────────────────
# All "is this slot in the past?" decisions must use the clinic's
# timezone, not the server's (a UTC container is 5.5h behind IST).
CLINIC_TZ = ZoneInfo(settings.CLINIC_TIMEZONE)


def clinic_now() -> datetime:
    return datetime.now(CLINIC_TZ)


def clinic_today() -> date:
    return clinic_now().date()

# ─── Clinic Configuration ─────────────────────────────────
DOCTORS = [
    {"name": "Dr Rajesh Sharma", "specialty": "Cardiologist", "experience": "15 years", "availability": "09:00 AM – 01:00 PM", "languages": ["English", "Hindi"], "icon": "❤️", "color": "#ef4444"},
    {"name": "Dr Ananya Iyer", "specialty": "General Physician", "experience": "10 years", "availability": "10:00 AM – 05:00 PM", "languages": ["English", "Tamil"], "icon": "🩺", "color": "#3b82f6"},
    {"name": "Dr Vikram Mehta", "specialty": "Dermatologist", "experience": "8 years", "availability": "11:00 AM – 04:00 PM", "languages": ["English", "Hindi"], "icon": "🧴", "color": "#8b5cf6"},
    {"name": "Dr Priya Krishnan", "specialty": "Pediatrician", "experience": "12 years", "availability": "09:00 AM – 02:00 PM", "languages": ["English", "Tamil"], "icon": "🧸", "color": "#f59e0b"},
    {"name": "Dr Arjun Verma", "specialty": "Orthopedic Surgeon", "experience": "14 years", "availability": "12:00 PM – 05:00 PM", "languages": ["English", "Hindi"], "icon": "🦴", "color": "#10b981"},
    {"name": "Dr Kavya Reddy", "specialty": "Gynecologist", "experience": "11 years", "availability": "10:00 AM – 03:00 PM", "languages": ["English", "Tamil"], "icon": "👩‍⚕️", "color": "#ec4899"},
    {"name": "Dr Suresh Pillai", "specialty": "Neurologist", "experience": "18 years", "availability": "01:00 PM – 05:00 PM", "languages": ["English", "Tamil"], "icon": "🧠", "color": "#6366f1"},
    {"name": "Dr Neha Gupta", "specialty": "ENT Specialist", "experience": "9 years", "availability": "09:00 AM – 12:00 PM", "languages": ["English", "Hindi"], "icon": "👂", "color": "#f97316"},
    {"name": "Dr Rohit Kapoor", "specialty": "Psychiatrist", "experience": "13 years", "availability": "11:00 AM – 04:00 PM", "languages": ["English", "Hindi"], "icon": "🛋️", "color": "#14b8a6"},
    {"name": "Dr Meera Subramanian", "specialty": "Endocrinologist", "experience": "16 years", "availability": "10:00 AM – 02:00 PM", "languages": ["English", "Tamil"], "icon": "🩸", "color": "#84cc16"},
    {"name": "Dr Karan Malhotra", "specialty": "Gastroenterologist", "experience": "12 years", "availability": "12:00 PM – 05:00 PM", "languages": ["English", "Hindi"], "icon": "🫃", "color": "#a855f7"},
    {"name": "Dr Divya Natarajan", "specialty": "Ophthalmologist", "experience": "9 years", "availability": "09:00 AM – 01:00 PM", "languages": ["English", "Tamil"], "icon": "👁️", "color": "#06b6d4"},
    {"name": "Dr Amit Saxena", "specialty": "Urologist", "experience": "14 years", "availability": "01:00 PM – 05:00 PM", "languages": ["English", "Hindi"], "icon": "💧", "color": "#3b82f6"},
    {"name": "Dr Lakshmi Narayanan", "specialty": "Pulmonologist", "experience": "17 years", "availability": "10:00 AM – 03:00 PM", "languages": ["English", "Tamil"], "icon": "🫁", "color": "#0ea5e9"},
    {"name": "Dr Pooja Bansal", "specialty": "Dentist", "experience": "8 years", "availability": "09:00 AM – 01:00 PM", "languages": ["English", "Hindi"], "icon": "🦷", "color": "#f43f5e"},
]

DOCTOR_NAMES = [d["name"] for d in DOCTORS]

CLINIC_START = "09:00"
CLINIC_END   = "17:00"
SLOT_DURATION = 30  # minutes


def _generate_time_slots(start: str, end: str, step_minutes: int) -> list[str]:
    """Derive the bookable slots from clinic hours so they can never drift apart."""
    slots = []
    cursor = datetime.strptime(start, "%H:%M")
    end_dt = datetime.strptime(end, "%H:%M")
    while cursor < end_dt:
        slots.append(cursor.strftime("%H:%M"))
        cursor += timedelta(minutes=step_minutes)
    return slots


TIME_SLOTS = _generate_time_slots(CLINIC_START, CLINIC_END, SLOT_DURATION)

# Azure neural voices per language
AZURE_VOICES = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
}

GROQ_MODEL    = "llama-3.3-70b-versatile"
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large-v2
