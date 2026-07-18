import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from pydantic import BaseModel, Field

from core.rate_limit import limiter
from services.auth_service import get_current_user
from services.stt_service import transcribe
from services.tts_service import synthesize_speech

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

MAX_AUDIO_BYTES = 10 * 1024 * 1024   # 10 MB ≈ several minutes of webm/opus
MAX_TTS_CHARS   = 1000


# ── STT endpoint ───────────────────────────────────────────
@router.post("/voice/stt")
@limiter.limit("30/minute")
async def speech_to_text(
    request: Request,
    response: Response,   # slowapi injects X-RateLimit headers here
    audio: UploadFile = File(...),
    language_hint: Optional[str] = Form(None),
):
    """
    Accept uploaded audio (webm/wav/mp3) → return transcript + detected language.
    """
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio upload.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10 MB).")

    try:
        # Whisper inference is CPU-bound — keep it off the event loop.
        return await asyncio.to_thread(transcribe, audio_bytes, language_hint)
    except Exception:
        logger.exception("STT error")
        raise HTTPException(status_code=500, detail="Transcription failed. Please try again.")


# ── TTS endpoint ───────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TTS_CHARS)
    language: str = "en"


@router.post("/voice/tts")
@limiter.limit("40/minute")
async def text_to_speech(request: Request, req: TTSRequest):
    """
    Accept text + language code → return MP3 audio bytes.
    """
    try:
        audio_bytes = await asyncio.to_thread(synthesize_speech, req.text, req.language)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"},
        )
    except Exception:
        logger.exception("TTS error")
        raise HTTPException(status_code=500, detail="Speech synthesis failed. Please try again.")
