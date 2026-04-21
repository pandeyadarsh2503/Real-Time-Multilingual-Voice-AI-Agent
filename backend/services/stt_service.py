"""
Speech-to-Text via faster-whisper.
Saves audio to a temp file (required for ffmpeg-backed decoding of webm/opus).
"""
import os
import tempfile
import logging
from faster_whisper import WhisperModel
from config import WHISPER_MODEL

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info(f"Loading Whisper model '{WHISPER_MODEL}' …")
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        logger.info("Whisper model ready.")
    return _model


def transcribe(audio_bytes: bytes, language_hint: str | None = None) -> dict:
    """
    Transcribe raw audio bytes (webm/wav/mp3 …) to text.
    Returns: { text, language, confidence }
    """
    model = _get_model()

    suffix = ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        kwargs = {}
        if language_hint and language_hint in ("en", "hi", "ta"):
            # Whisper uses ISO-639-1 codes
            kwargs["language"] = language_hint

        segments, info = model.transcribe(tmp_path, beam_size=5, **kwargs)
        text = " ".join(seg.text.strip() for seg in segments).strip()

        lang_map = {"hi": "hi", "ta": "ta", "en": "en"}
        detected = lang_map.get(info.language, "en")

        return {
            "text": text,
            "language": detected,
            "confidence": round(info.language_probability, 3),
        }
    finally:
        os.unlink(tmp_path)


def detect_language_from_text(text: str) -> str:
    """Heuristic language detection from Unicode character ranges."""
    for ch in text:
        if "\u0900" <= ch <= "\u097F":   # Devanagari → Hindi
            return "hi"
        if "\u0B80" <= ch <= "\u0BFF":   # Tamil block
            return "ta"
    return "en"
