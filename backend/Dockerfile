# ──────────────────────────────────────────────────────────────────────────────
# SwasthyaAI — Backend Dockerfile
# FastAPI + faster-whisper + Azure TTS + Groq
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# ── OS-level dependencies ──────────────────────────────────────────────────────
# ffmpeg      : required by faster-whisper to decode webm/opus audio
# libgomp1    : OpenMP runtime needed by ctranslate2 (faster-whisper backend)
# build-essential / wget : needed to install Azure Speech SDK native libs
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgomp1 \
        build-essential \
        wget \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ─────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first so Docker layer cache is reused on code-only changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application source ────────────────────────────────────────────────────────
COPY . .

# ── Whisper model pre-download ────────────────────────────────────────────────
# Downloads the 'base' Whisper model at build time so the first request
# is not slow. Remove this RUN step to defer download to runtime instead.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" \
    || true

# ── Runtime configuration ─────────────────────────────────────────────────────
# PORT is injected at runtime; defaults to 8000.
ENV PORT=8000

EXPOSE 8000

# Entrypoint: run uvicorn.  HOST=0.0.0.0 is required inside Docker so the
# port is reachable from outside the container.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
