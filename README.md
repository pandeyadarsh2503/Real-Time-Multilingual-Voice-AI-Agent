# 🏥 ClinicAI — Real-Time Multilingual AI Voice Assistant

A full-stack, production-grade AI voice assistant for healthcare clinics.
Manages appointment booking, rescheduling, and cancellation through natural conversation
in **English**, **Hindi**, and **Tamil** — via voice or text.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite (WebRTC voice capture) |
| **Backend** | FastAPI (Python 3.11+) |
| **LLM** | Groq API — LLaMA 3 70B |
| **STT** | faster-whisper (base model, CPU) |
| **TTS** | Azure Cognitive Services Neural TTS |
| **Database** | SQLite via SQLAlchemy ORM |
| **Outbound Calls** | Exotel Click-to-Call API |

---

## 📁 Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── config.py                  # Clinic config + settings
│   ├── requirements.txt
│   ├── .env.example
│   ├── database/
│   │   ├── database.py            # SQLAlchemy engine
│   │   └── models.py              # ORM models
│   ├── tools/
│   │   └── appointment_tools.py   # Tool executors (CRUD + validation)
│   ├── services/
│   │   ├── llm_service.py         # Groq LLaMA-3 agent loop
│   │   ├── stt_service.py         # Whisper transcription
│   │   ├── tts_service.py         # Azure TTS (gTTS fallback)
│   │   ├── memory_service.py      # Session + patient memory
│   │   └── exotel_service.py      # Outbound call API
│   └── routers/
│       ├── chat.py                # POST /api/chat
│       ├── voice.py               # POST /api/voice/stt|tts
│       ├── appointments.py        # CRUD /api/appointments
│       └── outbound.py            # /api/outbound/*
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx                # Root component + layout
        ├── main.jsx
        ├── styles/index.css       # Dark glassmorphism design system
        ├── hooks/useWebRTC.js     # Mic capture + waveform analyser
        ├── services/api.js        # Axios API client
        └── components/
            ├── ChatWindow.jsx     # Conversation bubbles
            ├── VoiceInterface.jsx # Mic + waveform + text input
            ├── StatusBar.jsx      # Listening/Thinking/Speaking
            ├── DoctorPanel.jsx    # Doctor cards + availability
            ├── AppointmentCard.jsx# Upcoming appointments
            └── OutboundPanel.jsx  # Reminder simulation
```

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and fill in your API keys:
#   GROQ_API_KEY, AZURE_TTS_KEY, AZURE_TTS_REGION
#   EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID, EXOTEL_CALLER_ID

# Start server
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

App available at: http://localhost:5173

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (get from console.groq.com) |
| `AZURE_TTS_KEY` | Azure Speech Services key |
| `AZURE_TTS_REGION` | Azure region (e.g. `eastus`) |
| `EXOTEL_API_KEY` | Exotel API key |
| `EXOTEL_API_TOKEN` | Exotel API token |
| `EXOTEL_SID` | Exotel Account SID |
| `EXOTEL_CALLER_ID` | Your Exotel virtual number |
| `DATABASE_URL` | SQLite URL (default: `sqlite:///./clinic.db`) |

---

## 🏥 Clinic Configuration

Edit `backend/config.py` to change:
- Doctor list and specialties
- Working hours and slot duration
- Azure voice names per language
- Whisper model size

---

## 🎯 Features

### Voice Pipeline
```
🎤 Mic (WebRTC) → FastAPI → Whisper STT → Groq LLaMA-3 → Azure TTS → 🔊 Speaker
```

### Appointment Management
- ✅ Book appointments (with conflict detection)
- 🔄 Reschedule appointments
- ✕ Cancel appointments
- 📅 Check doctor availability
- ⏰ Validate working hours + no past-time booking

### Multilingual Support
- 🇬🇧 English — `en-IN-NeerjaNeural`
- 🇮🇳 Hindi — `hi-IN-SwaraNeural`
- 🇮🇳 Tamil — `ta-IN-PallaviNeural`
- Auto-detection from voice (Whisper) and text (Unicode heuristic)

### Outbound Reminders
- Exotel Click-to-Call for patient reminders
- Simulation mode for testing without live calls
- Webhook handler for DTMF digit responses (1=confirm, 2=reschedule, 3=cancel)

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send text message, get AI response |
| POST | `/api/voice/stt` | Upload audio → transcript |
| POST | `/api/voice/tts` | Text → MP3 audio |
| GET | `/api/appointments` | List appointments |
| GET | `/api/appointments/today` | Today grouped by doctor |
| GET | `/api/appointments/upcoming` | Next N appointments |
| GET | `/api/appointments/{id}` | Single appointment |
| DELETE | `/api/appointments/{id}` | Cancel appointment |
| POST | `/api/outbound/trigger` | Trigger Exotel call |
| POST | `/api/outbound/simulate` | Simulate reminder (no call) |
| POST | `/api/outbound/webhook` | Exotel webhook callback |
| GET | `/api/outbound/upcoming-reminders` | Tomorrow's appointments |

---

## 🧠 LLM Agent Flow

```
User Input
    ↓
Groq LLaMA-3 (with 4 tool definitions)
    ↓
Tool Call? ──YES──→ Execute Tool (SQLite) → Return Result → LLaMA-3 again
    ↓ NO
Final Text Response
    ↓
Azure TTS → MP3 → Browser Audio
```

---

## 🔧 Customisation

### Add a new doctor
In `backend/config.py`:
```python
DOCTORS.append({"name": "Dr Patel", "specialty": "Orthopedist", "icon": "🦴", "color": "#10b981"})
```

### Change Whisper model
In `backend/config.py`:
```python
WHISPER_MODEL = "medium"   # better accuracy, slower
```

### Add language support
In `backend/config.py`:
```python
AZURE_VOICES["te"] = "te-IN-MohanNeural"  # Telugu
```

---

## 📋 Clinic Rules (Enforced)

- Working hours: 09:00 – 17:00 (slots every 30 min)
- No double booking (same doctor + date + time)
- No past-date bookings
- No past-time bookings for today
- Confirmation required before any booking
- Up to 3 alternative slots suggested on conflict

---

## 🌐 Browser Support

| Browser | Voice Input | TTS Playback |
|---|---|---|
| Chrome | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Firefox | ⚠️ (limited MediaRecorder) | ✅ |
| Safari | ✅ (iOS 14.5+) | ✅ |

> **Note:** Text input works in all browsers. Voice input requires HTTPS in production.

---

## 📦 Dependencies

### Backend
```
fastapi, uvicorn, groq, faster-whisper, azure-cognitiveservices-speech,
sqlalchemy, requests, python-multipart, pydantic-settings
```

### Frontend
```
react, react-dom, axios, uuid, react-icons, react-hot-toast
```
