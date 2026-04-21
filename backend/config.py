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

GROQ_MODEL    = "llama-3.3-70b-versatile"
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large-v2
