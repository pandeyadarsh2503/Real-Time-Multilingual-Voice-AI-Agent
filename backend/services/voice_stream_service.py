"""
Live voice pipeline over WebRTC (aiortc).

    mic ──Opus/SRTP──▶ inbound track ─▶ resample 16k ─▶ UtteranceSegmenter (Silero VAD)
                                                          │ partials every ~1.2s
                                                          ▼
                                             faster-whisper transcription
                                                          ▼
                                             shared agent runtime (Groq + tools)
                                                          ▼
                        outbound track ◀─ 16k PCM ◀─ Azure TTS
    events (partial/final transcripts, agent text, state) ride a DataChannel.

Design notes:
- VAD is the Silero model already bundled with faster-whisper — no
  extra ML dependency. The segmenter is a plain synchronous state
  machine with an injectable `vad` callable so it unit-tests without
  audio models.
- All heavy work (Whisper, Groq, Azure) runs in worker threads;
  the event loop only moves frames.
- Barge-in: if the caller starts speaking while the agent's audio is
  still queued, the outbound buffer is flushed immediately.
"""
import asyncio
import json
import logging
import time
import uuid
from fractions import Fraction
from typing import Callable, Optional

import numpy as np
from aiortc import MediaStreamTrack
from av import AudioFrame
from av.audio.resampler import AudioResampler

from database.database import SessionLocal
from services.agent_runtime import run_chat_turn
from services.stt_service import transcribe_pcm
from services.tts_service import synthesize_pcm

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2

# Segmentation tuning (milliseconds)
VAD_HOP_MS          = 300    # VAD decides once per fresh hop of audio
SILENCE_END_MS      = 600    # trailing silence that ends an utterance (2 clean hops)
MIN_UTTERANCE_MS    = 400    # discard blips shorter than this
PREROLL_MS          = 300    # audio kept from just before speech onset
PARTIAL_INTERVAL_MS = 1200   # cadence of partial transcripts

MAX_LIVE_SESSIONS = 4


def silero_vad(audio_f32: np.ndarray) -> bool:
    """True if the window contains speech (Silero via faster-whisper)."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    ts = get_speech_timestamps(
        audio_f32,
        VadOptions(min_speech_duration_ms=100, min_silence_duration_ms=100),
    )
    return len(ts) > 0


class UtteranceSegmenter:
    """
    Feed 16 kHz float32 chunks; get complete utterances back.

    States: idle → speaking → (silence ≥ SILENCE_END_MS) → utterance out.
    `vad` is injectable so tests can drive the state machine directly.
    """

    def __init__(self, vad: Callable[[np.ndarray], bool] = silero_vad):
        self._vad = vad
        self._hop = np.zeros(0, dtype=np.float32)   # audio since last VAD decision
        self._utterance: list[np.ndarray] = []
        self._preroll = np.zeros(0, dtype=np.float32)
        self.speaking = False
        self._silence_ms = 0.0
        self._speech_ms = 0.0
        self._since_partial_ms = 0.0
        self.speech_just_started = False

    def feed(self, chunk: np.ndarray) -> Optional[np.ndarray]:
        """Returns a finished utterance (float32) or None."""
        self.speech_just_started = False
        chunk_ms = len(chunk) / SAMPLE_RATE * 1000

        if self.speaking:
            self._utterance.append(chunk)
            self._since_partial_ms += chunk_ms
        else:
            self._preroll = np.concatenate([self._preroll, chunk])
            preroll_max = int(SAMPLE_RATE * PREROLL_MS / 1000)
            if len(self._preroll) > preroll_max:
                self._preroll = self._preroll[-preroll_max:]

        # Each VAD decision sees only fresh audio — an overlapping window
        # would keep "seeing" old speech and stretch silence detection.
        self._hop = np.concatenate([self._hop, chunk])
        if len(self._hop) < int(SAMPLE_RATE * VAD_HOP_MS / 1000):
            return None
        hop_audio, self._hop = self._hop, np.zeros(0, dtype=np.float32)

        has_speech = self._vad(hop_audio)

        if not self.speaking:
            if has_speech:
                self.speaking = True
                self.speech_just_started = True
                self._utterance = [self._preroll.copy()]
                self._preroll = np.zeros(0, dtype=np.float32)
                self._silence_ms = 0.0
                self._speech_ms = 0.0
                self._since_partial_ms = 0.0
            return None

        if has_speech:
            self._silence_ms = 0.0
            self._speech_ms += VAD_HOP_MS
            return None

        self._silence_ms += VAD_HOP_MS
        if self._silence_ms < SILENCE_END_MS:
            return None

        # utterance complete
        audio = np.concatenate(self._utterance) if self._utterance else np.zeros(0, dtype=np.float32)
        self.speaking = False
        self._utterance = []
        self._silence_ms = 0.0
        if self._speech_ms < MIN_UTTERANCE_MS:
            return None
        return audio

    def partial_due(self) -> bool:
        if self.speaking and self._since_partial_ms >= PARTIAL_INTERVAL_MS:
            self._since_partial_ms = 0.0
            return True
        return False

    def utterance_snapshot(self) -> np.ndarray:
        if not self._utterance:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(self._utterance)


class OutboundAudioTrack(MediaStreamTrack):
    """Server → browser audio: a paced 20ms frame source fed from a byte
    buffer. Emits silence when idle so the RTP clock never stalls."""

    kind = "audio"
    FRAME_SAMPLES = 320  # 20 ms @ 16 kHz

    def __init__(self):
        super().__init__()
        self._buffer = bytearray()
        self._start: Optional[float] = None
        self._timestamp = 0

    def write(self, pcm: bytes):
        self._buffer.extend(pcm)

    def flush(self) -> int:
        """Drop queued audio (barge-in). Returns dropped byte count."""
        dropped = len(self._buffer)
        self._buffer.clear()
        return dropped

    @property
    def pending_ms(self) -> float:
        return len(self._buffer) / (SAMPLE_RATE * BYTES_PER_SAMPLE) * 1000

    async def recv(self) -> AudioFrame:
        if self._start is None:
            self._start = time.monotonic()
        else:
            due = self._start + self._timestamp / SAMPLE_RATE
            delay = due - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)

        nbytes = self.FRAME_SAMPLES * BYTES_PER_SAMPLE
        if len(self._buffer) >= nbytes:
            chunk = bytes(self._buffer[:nbytes])
            del self._buffer[:nbytes]
        else:
            chunk = b"\x00" * nbytes

        frame = AudioFrame(format="s16", layout="mono", samples=self.FRAME_SAMPLES)
        frame.planes[0].update(chunk)
        frame.sample_rate = SAMPLE_RATE
        frame.pts = self._timestamp
        frame.time_base = Fraction(1, SAMPLE_RATE)
        self._timestamp += self.FRAME_SAMPLES
        return frame


class VoiceSession:
    """One live conversation: owns the segmenter, outbound track, and
    DataChannel; runs the STT → agent → TTS turn for each utterance."""

    def __init__(self, user: dict):
        self.id = uuid.uuid4().hex[:8]
        self.user = user
        self.session_id = f"live-{self.id}"
        self.language: Optional[str] = None
        self.outbound = OutboundAudioTrack()
        self.segmenter = UtteranceSegmenter()
        self._channel = None
        self._pending_events: list[dict] = []
        self._track_task: Optional[asyncio.Task] = None
        self._turn_lock = asyncio.Lock()
        self._partial_busy = False
        self.closed = False

    # ── DataChannel events ────────────────────────────────
    def attach_channel(self, channel):
        self._channel = channel
        for event in self._pending_events:
            self._send_raw(event)
        self._pending_events.clear()

    def send_event(self, event: dict):
        if self._channel is not None and self._channel.readyState == "open":
            self._send_raw(event)
        else:
            self._pending_events.append(event)

    def _send_raw(self, event: dict):
        try:
            self._channel.send(json.dumps(event, ensure_ascii=False))
        except Exception:
            logger.debug("DataChannel send failed (session %s)", self.id)

    # ── Inbound audio ─────────────────────────────────────
    def start(self, track: MediaStreamTrack):
        self._track_task = asyncio.create_task(self._consume(track))
        self.send_event({"type": "state", "value": "listening"})

    async def _consume(self, track: MediaStreamTrack):
        resampler = AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
        try:
            while not self.closed:
                frame = await track.recv()
                for out in resampler.resample(frame):
                    pcm = out.to_ndarray().flatten().astype(np.float32) / 32768.0
                    utterance = self.segmenter.feed(pcm)

                    if self.segmenter.speech_just_started:
                        if self.outbound.pending_ms > 100:
                            dropped = self.outbound.flush()
                            self.send_event({"type": "interrupted"})
                            logger.info("Session %s barge-in: dropped %d bytes of TTS", self.id, dropped)
                        self.send_event({"type": "state", "value": "listening"})

                    if utterance is not None:
                        asyncio.create_task(self._handle_utterance(utterance))
                    elif self.segmenter.partial_due() and not self._partial_busy:
                        asyncio.create_task(self._emit_partial())
        except Exception as exc:
            if not self.closed:
                logger.info("Session %s inbound track ended: %s", self.id, exc)

    async def _emit_partial(self):
        self._partial_busy = True
        try:
            snapshot = self.segmenter.utterance_snapshot()
            if len(snapshot) < SAMPLE_RATE // 2:
                return
            result = await asyncio.to_thread(transcribe_pcm, snapshot, self.language)
            if result["text"]:
                self.send_event({"type": "partial_transcript", "text": result["text"]})
        except Exception:
            logger.exception("Partial transcription failed")
        finally:
            self._partial_busy = False

    # ── Full turn ─────────────────────────────────────────
    async def _handle_utterance(self, pcm: np.ndarray):
        async with self._turn_lock:
            try:
                self.send_event({"type": "state", "value": "thinking"})
                stt = await asyncio.to_thread(transcribe_pcm, pcm, self.language)
                text = stt["text"]
                if not text:
                    self.send_event({"type": "state", "value": "listening"})
                    return

                lang = stt["language"]
                self.language = lang
                self.send_event({"type": "final_transcript", "text": text, "language": lang})

                db = SessionLocal()
                try:
                    reply = await run_chat_turn(
                        message=text,
                        session_id=self.session_id,
                        user=self.user,
                        lang=lang,
                        db=db,
                    )
                finally:
                    db.close()

                self.send_event({"type": "agent_response", "text": reply, "language": lang})
                self.send_event({"type": "state", "value": "speaking"})

                audio = await asyncio.to_thread(synthesize_pcm, reply, lang)
                self.outbound.write(audio)
                duration = len(audio) / (SAMPLE_RATE * BYTES_PER_SAMPLE)
                asyncio.create_task(self._back_to_listening(duration))
            except Exception:
                logger.exception("Voice turn failed (session %s)", self.id)
                self.send_event({"type": "error", "message": "Sorry, something went wrong. Please try again."})
                self.send_event({"type": "state", "value": "listening"})

    async def _back_to_listening(self, seconds: float):
        await asyncio.sleep(seconds + 0.3)
        if not self.closed and self.outbound.pending_ms < 50:
            self.send_event({"type": "state", "value": "listening"})

    async def close(self):
        self.closed = True
        if self._track_task:
            self._track_task.cancel()


# ── Session registry ───────────────────────────────────────
_sessions: dict[str, VoiceSession] = {}


def register(session: VoiceSession):
    _sessions[session.id] = session


async def unregister(session: VoiceSession):
    _sessions.pop(session.id, None)
    await session.close()


def active_count() -> int:
    return len(_sessions)
