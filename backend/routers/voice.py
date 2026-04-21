from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import logging

from services.stt_service import transcribe
from services.tts_service import synthesize_speech

logger = logging.getLogger(__name__)
router = APIRouter()


# ── STT endpoint ───────────────────────────────────────────
@router.post("/voice/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language_hint: Optional[str] = Form(None),
):
    """
    Accept uploaded audio (webm/wav/mp3) → return transcript + detected language.
    """
    try:
        audio_bytes = await audio.read()
        result = transcribe(audio_bytes, language_hint)
        return result
    except Exception as exc:
        logger.error(f"STT error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── TTS endpoint ───────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/voice/tts")
async def text_to_speech(req: TTSRequest):
    """
    Accept text + language code → return MP3 audio bytes.
    """
    try:
        audio_bytes = synthesize_speech(req.text, req.language)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=response.mp3"},
        )
    except Exception as exc:
        logger.error(f"TTS error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
