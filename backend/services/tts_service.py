"""
Text-to-Speech via Azure Cognitive Services.
Returns raw MP3 bytes that FastAPI streams back to the browser.
Falls back to gTTS if Azure credentials are missing.
"""
import io
import logging

import azure.cognitiveservices.speech as speechsdk

from config import AZURE_VOICES, settings

logger = logging.getLogger(__name__)


def synthesize_speech(text: str, language: str = "en") -> bytes:
    """
    Convert text → MP3 audio bytes using Azure Neural TTS.
    Language codes: 'en' | 'hi' | 'ta'
    """
    if not settings.AZURE_TTS_KEY:
        return _gtts_fallback(text, language)

    voice = AZURE_VOICES.get(language, AZURE_VOICES["en"])

    speech_config = speechsdk.SpeechConfig(
        subscription=settings.AZURE_TTS_KEY,
        region=settings.AZURE_TTS_REGION,
    )
    speech_config.speech_synthesis_voice_name = voice
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3
    )

    # audio_config=None → capture bytes, no speaker output
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config, audio_config=None
    )
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        logger.info(f"Azure TTS OK | lang={language} | voice={voice} | chars={len(text)}")
        return result.audio_data

    details = speechsdk.CancellationDetails.from_result(result)
    logger.error(f"Azure TTS failed: {details.reason} — {details.error_details}")
    # Last-resort fallback
    return _gtts_fallback(text, language)


PCM_SAMPLE_RATE = 16000  # 16 kHz mono s16le — what the voice pipeline streams


def synthesize_pcm(text: str, language: str = "en") -> bytes:
    """
    Convert text → raw PCM (16 kHz, mono, s16le) for the WebRTC output
    track. Azure emits raw PCM natively; the gTTS fallback is decoded
    from MP3 with PyAV.
    """
    if not settings.AZURE_TTS_KEY:
        return _decode_mp3_to_pcm(_gtts_fallback(text, language))

    voice = AZURE_VOICES.get(language, AZURE_VOICES["en"])
    speech_config = speechsdk.SpeechConfig(
        subscription=settings.AZURE_TTS_KEY,
        region=settings.AZURE_TTS_REGION,
    )
    speech_config.speech_synthesis_voice_name = voice
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
    )
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return result.audio_data

    details = speechsdk.CancellationDetails.from_result(result)
    logger.error(f"Azure PCM TTS failed: {details.reason} — {details.error_details}")
    return _decode_mp3_to_pcm(_gtts_fallback(text, language))


def _decode_mp3_to_pcm(mp3_bytes: bytes) -> bytes:
    """MP3 → 16 kHz mono s16le PCM using PyAV."""
    import av
    from av.audio.resampler import AudioResampler

    container = av.open(io.BytesIO(mp3_bytes))
    resampler = AudioResampler(format="s16", layout="mono", rate=PCM_SAMPLE_RATE)
    chunks = []
    for frame in container.decode(audio=0):
        for out in resampler.resample(frame):
            chunks.append(bytes(out.planes[0]))
    container.close()
    return b"".join(chunks)


def _gtts_fallback(text: str, language: str) -> bytes:
    """gTTS fallback — returns MP3 bytes."""
    try:
        from gtts import gTTS
        lang_map = {"en": "en", "hi": "hi", "ta": "ta"}
        tts = gTTS(text=text, lang=lang_map.get(language, "en"))
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        logger.info(f"gTTS fallback used for lang={language}")
        return buf.read()
    except Exception as e:
        logger.error(f"gTTS also failed: {e}")
        raise RuntimeError("Both Azure TTS and gTTS failed.") from e
