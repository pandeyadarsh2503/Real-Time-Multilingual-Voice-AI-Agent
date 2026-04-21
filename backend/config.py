from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    AZURE_TTS_KEY: str = ""
    AZURE_TTS_REGION: str = "eastus"
    EXOTEL_API_KEY: str = ""
    EXOTEL_API_TOKEN: str = ""
    EXOTEL_SID: str = ""
    EXOTEL_CALLER_ID: str = ""
    DATABASE_URL: str = "sqlite:///./clinic.db"
    TTS_PROVIDER: str = "azure"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# ─── Clinic Configuration ─────────────────────────────────
DOCTORS = [
    {"name": "Dr Sharma", "specialty": "Cardiologist",       "icon": "❤️",  "color": "#ef4444"},
    {"name": "Dr Iyer",   "specialty": "General Physician",  "icon": "🩺",  "color": "#3b82f6"},
    {"name": "Dr Mehta",  "specialty": "Dermatologist",      "icon": "🧴",  "color": "#8b5cf6"},
]

DOCTOR_NAMES = [d["name"] for d in DOCTORS]

CLINIC_START = "09:00"
CLINIC_END   = "17:00"
SLOT_DURATION = 30  # minutes

TIME_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30",
]

# Azure neural voices per language
AZURE_VOICES = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
}

GROQ_MODEL    = "llama3-70b-8192"
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large-v2
