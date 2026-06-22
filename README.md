# SwasthyaAI: AI-Powered Multilingual Healthcare Assistant & Appointment Booking System

Production-grade, low-latency conversational AI agent orchestrating real-time healthcare scheduling, voice-to-text processing, and outbound reminders across English, Hindi, and Tamil.

---

## 1. System Architecture & Components

```
User Input ──[WebRTC]──> Speech-to-Text ──> LLM Agent Orchestrator ──> Tool Call (SQL Lock) ──> Text-to-Speech ──> Client Playback
```

### Core Architecture
- **Voice Pipeline**: Real-time WebRTC audio streaming to FastAPI backend.
- **Transcription**: `faster-whisper` (base) executing on local device CPU/GPU.
- **Orchestration**: LLaMA-3-70B via Groq API utilizing strict function calling constraints.
- **Synthesis**: Azure Cognitive Services Neural Text-to-Speech.
- **Data Store**: SQLite with SQLAlchemy ORM (enforcing transactional serialization).
- **Outbound Channel**: Exotel Click-to-Call API with webhook digit extraction.

### Repository Layout
```
├── backend/
│   ├── main.py                    # API Entrypoint
│   ├── config.py                  # Environment Constraints
│   ├── requirements.txt           # Dependency Manifest
│   ├── .env.example               # Template
│   ├── database/
│   │   ├── database.py            # Transaction Engine
│   │   └── models.py              # Schema Models
│   ├── tools/
│   │   └── appointment_tools.py   # CRUD Actions & Lock Enforcement
│   └── services/
│       ├── llm_service.py         # Groq LLM Agent Control Loop
│       ├── stt_service.py         # Whisper Transcription Service
│       ├── tts_service.py         # Azure TTS Synthesis Engine
│       ├── memory_service.py      # Session Cache & Patient Registry
│       └── exotel_service.py      # Telephony Integration
└── frontend/
    ├── src/
    │   ├── App.jsx                # Layout Core
    │   ├── styles/index.css       # CSS Design Token System
    │   ├── hooks/useWebRTC.js     # Media Capture & Stream Analyser
    │   └── services/api.js        # API Client Wrapper
```

---

## 2. Infrastructure Setup & Deployment

### Quick Start via Docker Compose (Recommended)
This runs the isolated stack with persistent volume storage.

1. **Clone Repository**
   ```bash
   git clone https://github.com/pandeyadarsh2503/Real-Time-Multilingual-Voice-AI-Agent.git
   cd Real-Time-Multilingual-Voice-AI-Agent
   ```

2. **Configure Environment**
   ```bash
   copy backend\.env.example backend\.env
   ```
   *Required variables within `backend/.env`:*
   - `GROQ_API_KEY`: Groq Console API Token
   - `AZURE_TTS_KEY`: Azure Cognitive Speech Access Key
   - `AZURE_TTS_REGION`: Location region (e.g. `eastus`)
   - `EXOTEL_API_KEY` / `EXOTEL_API_TOKEN` / `EXOTEL_SID` / `EXOTEL_CALLER_ID`: Exotel Telephony Credentials

3. **Deploy Containerized Stack**
   ```bash
   docker compose up --build
   ```
   *Access URLs:*
   - **Frontend UI**: `http://localhost:5173`
   - **API Specs**: `http://localhost:8000/docs`

---

## 3. Manual Local Installation

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Receives raw user text; returns agent text response. |
| `POST` | `/api/voice/stt` | Uploads WebM audio stream; returns text transcription. |
| `POST` | `/api/voice/tts` | Converts text string to MP3 audio stream. |
| `GET` | `/api/appointments` | Lists entire database booking registry. |
| `GET` | `/api/appointments/today` | Active bookings for current date grouped by practitioner. |
| `GET` | `/api/appointments/upcoming` | Retrieve next `N` chronologically sorted bookings. |
| `DELETE` | `/api/appointments/{id}` | Immediate hard cancellation of targeted slot. |
| `POST` | `/api/outbound/trigger` | Triggers live Exotel outbound reminder call. |
| `POST` | `/api/outbound/simulate` | Triggers simulated outbound reminder. |
| `POST` | `/api/outbound/webhook` | Listens to Exotel caller DTMF input responses. |

---

## 5. Strict Clinic Constraints

The agent strictly enforces these rules programmatically:
- **Operation Hours**: `09:00` to `17:00` (in `30`-minute interval slots).
- **Concurrency Prevention**: SQLite unique constraints `uq_scheduled_slot` on `(doctor, date, time, status)` combined with SQLAlchemy `.with_for_update()` SELECT locks.
- **Temporal Enforcement**: No historic date booking; no historic time booking for the current day.
- **Implicit Rules**: Suggests up to 3 fallback slots in case of conflicts; booking requires explicit patient confirmation.

---

## 6. Development & Customization

All configurations reside in [config.py](file:///c:/Users/pande/OneDrive/Desktop/Real%20Time%20Voice%20Multilingual%20AI%20agent/backend/config.py):

### Registering Practitioners
```python
DOCTORS.append({
    "name": "Dr Patel",
    "specialty": "Orthopedist",
    "icon": "🦴",
    "color": "#10b981"
})
```

### Custom Speech Model Size
```python
WHISPER_MODEL = "medium" # CPU memory required: ~1.5 GB
```

### Adding Voice Synthesis Locale
```python
AZURE_VOICES["te"] = "te-IN-MohanNeural"
```
