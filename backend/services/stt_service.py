"""
Speech-to-Text via faster-whisper.
Saves audio to a temp file (required for ffmpeg-backed decoding of webm/opus).
"""
import logging
import os
import tempfile
import threading

from faster_whisper import WhisperModel

from config import WHISPER_MODEL

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None
# A single shared model runs across the asyncio threadpool; faster-whisper
# transcribe() is not safe to call concurrently on one model, so serialize it.
_model_lock = threading.Lock()


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

        with _model_lock:
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


def warm_up():
    """Load the Whisper model ahead of the first request (called at
    startup in a worker thread) so first-utterance latency is model
    inference only, never model loading."""
    _get_model()


def transcribe_pcm(pcm_f32, language_hint: str | None = None, beam_size: int = 5) -> dict:
    """
    Transcribe a float32 mono 16 kHz numpy array (the live-voice path —
    no temp files, no container decode). beam_size=1 (greedy) is used for
    low-latency partial transcripts; beam_size=5 for the final utterance.
    Returns: { text, language, confidence }
    """
    model = _get_model()
    kwargs = {}
    if language_hint and language_hint in ("en", "hi", "ta"):
        kwargs["language"] = language_hint

    with _model_lock:
        segments, info = model.transcribe(pcm_f32, beam_size=beam_size, **kwargs)
        text = " ".join(seg.text.strip() for seg in segments).strip()
    detected = info.language if info.language in ("en", "hi", "ta") else "en"
    return {
        "text": text,
        "language": detected,
        "confidence": round(info.language_probability, 3),
    }


def detect_language_from_text(text: str) -> str:
    """Heuristic language detection from Unicode character ranges."""
    for ch in text:
        if "\u0900" <= ch <= "\u097F":   # Devanagari → Hindi
            return "hi"
        if "\u0B80" <= ch <= "\u0BFF":   # Tamil block
            return "ta"
    return "en"
