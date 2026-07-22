FROM python:3.11-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgomp1 \
        build-essential \
        wget \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Keep the Whisper/HF model cache inside the image so it's owned by appuser.
ENV HF_HOME=/app/.cache/huggingface

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" \
    || true

# Drop root: run as an unprivileged user, owning the app dir, the model
# cache, and the /data mount (a fresh named volume inherits this ownership).
RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

# WEB_CONCURRENCY>1 needs REDIS_URL set (the in-process session store is
# per-worker); it defaults to 1 so the zero-config path stays correct.
ENV PORT=8000 \
    WEB_CONCURRENCY=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY}"]
