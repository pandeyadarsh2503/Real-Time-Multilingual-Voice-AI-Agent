"""
Tests for the live-voice building blocks: the VAD utterance segmenter
state machine (driven with an injected fake VAD — no audio models) and
the paced outbound WebRTC audio track.
"""
import asyncio
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.voice_stream_service import (
    MIN_UTTERANCE_MS,
    SAMPLE_RATE,
    OutboundAudioTrack,
    UtteranceSegmenter,
)

CHUNK = SAMPLE_RATE // 10  # 100 ms chunks


def speech(n_chunks):
    return [np.ones(CHUNK, dtype=np.float32) * 0.8 for _ in range(n_chunks)]


def silence(n_chunks):
    return [np.zeros(CHUNK, dtype=np.float32) for _ in range(n_chunks)]


def amplitude_vad(window: np.ndarray) -> bool:
    return float(np.abs(window).max()) > 0.5


def feed_all(seg, chunks):
    utterances = []
    for c in chunks:
        out = seg.feed(c)
        if out is not None:
            utterances.append(out)
    return utterances


def test_silence_produces_nothing():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    assert feed_all(seg, silence(30)) == []
    assert seg.speaking is False


def test_speech_then_silence_emits_one_utterance():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    utterances = feed_all(seg, speech(12) + silence(12))
    assert len(utterances) == 1
    # roughly the spoken second (plus preroll), definitely not the silence
    assert len(utterances[0]) >= SAMPLE_RATE * 0.8
    assert seg.speaking is False


def test_short_blip_is_discarded():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    # ~200ms of "speech" — under MIN_UTTERANCE_MS
    assert MIN_UTTERANCE_MS >= 400
    utterances = feed_all(seg, speech(2) + silence(15))
    assert utterances == []


def test_two_utterances_are_separated():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    utterances = feed_all(seg, speech(10) + silence(10) + speech(10) + silence(10))
    assert len(utterances) == 2


def test_speech_just_started_fires_once():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    fired = 0
    for c in speech(10):
        seg.feed(c)
        if seg.speech_just_started:
            fired += 1
    assert fired == 1


def test_partials_come_due_while_speaking():
    seg = UtteranceSegmenter(vad=amplitude_vad)
    due = 0
    for c in speech(30):  # 3 seconds of speech
        seg.feed(c)
        if seg.partial_due():
            due += 1
    assert due >= 1
    assert len(seg.utterance_snapshot()) > SAMPLE_RATE  # snapshot grows


# ── Outbound track ─────────────────────────────────────────

def test_outbound_track_silence_then_audio_then_flush():
    async def scenario():
        track = OutboundAudioTrack()

        frame = await track.recv()               # nothing queued → silence
        assert bytes(frame.planes[0])[: 2 * track.FRAME_SAMPLES] == b"\x00" * (2 * track.FRAME_SAMPLES)

        track.write(b"\x11\x22" * track.FRAME_SAMPLES)   # one frame of audio
        assert track.pending_ms > 0
        frame = await track.recv()
        assert bytes(frame.planes[0])[:4] == b"\x11\x22\x11\x22"
        assert frame.sample_rate == SAMPLE_RATE

        track.write(b"\x33\x44" * track.FRAME_SAMPLES * 10)
        dropped = track.flush()                  # barge-in
        assert dropped == 2 * track.FRAME_SAMPLES * 10
        assert track.pending_ms == 0

    asyncio.run(scenario())


def test_outbound_track_timestamps_advance():
    async def scenario():
        track = OutboundAudioTrack()
        f1 = await track.recv()
        f2 = await track.recv()
        assert f2.pts - f1.pts == track.FRAME_SAMPLES

    asyncio.run(scenario())
