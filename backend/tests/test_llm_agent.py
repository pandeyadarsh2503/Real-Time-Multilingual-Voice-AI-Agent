"""
Tests for the agent loop's safety guards (no live Groq):
  - fabricated appointment-ID confirmations are caught and corrected
  - max_iter exhaustion appends its fallback as an assistant turn (no
    dangling tool result that would 400 the next turn)
"""
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncio

from services import llm_service


def _msg(content=None, tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls)


def _resp(message):
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _tool_call(cid, name, args="{}"):
    return SimpleNamespace(
        id=cid, function=SimpleNamespace(name=name, arguments=args)
    )


def _patch_groq(monkeypatch, responses):
    """Feed run_agent a scripted sequence of Groq responses."""
    seq = iter(responses)

    def fake_create(*args, **kwargs):
        return _resp(next(seq))

    monkeypatch.setattr(llm_service.client.chat.completions, "create", fake_create)


async def _noop_executor(name, args):
    return {"ok": True}


def test_fabricated_appointment_id_is_corrected(monkeypatch):
    # 1st turn: model invents a confirmation with a fake 8-hex ID and no tool call.
    # 2nd turn (after correction): a clean reply with no fabricated ID.
    _patch_groq(monkeypatch, [
        _msg(content="Your appointment is booked! ID: ABCD1234"),
        _msg(content="Sorry — what date would you like?"),
    ])
    text, msgs = asyncio.run(
        llm_service.run_agent([{"role": "user", "content": "book me"}], _noop_executor)
    )
    assert text == "Sorry — what date would you like?"
    assert "ABCD1234" not in text
    # a correction (system) message was injected before the retry
    assert any(m["role"] == "system" and "invent" in m["content"].lower() for m in msgs)


def test_real_tool_id_is_allowed_through(monkeypatch):
    # Model books via the tool (which returns a real id), then confirms it.
    async def booking_executor(name, args):
        return {"success": True, "appointment_id": "REAL9999"}

    _patch_groq(monkeypatch, [
        _msg(tool_calls=[_tool_call("t1", "book_appointment",
                                    '{"name":"A","doctor":"Dr","date":"2026-08-01","time":"10:00"}')]),
        _msg(content="Done! Your appointment ID is REAL9999."),
    ])
    text, _ = asyncio.run(
        llm_service.run_agent([{"role": "user", "content": "book"}], booking_executor)
    )
    assert text == "Done! Your appointment ID is REAL9999."


def test_max_iter_fallback_is_appended(monkeypatch):
    # Model loops forever on tool calls; after max_iter we must return the
    # fallback AND end msgs on an assistant message, not a tool result.
    loop_resp = _msg(tool_calls=[_tool_call("t1", "check_availability",
                                            '{"doctor":"Dr","date":"2026-08-01"}')])
    _patch_groq(monkeypatch, [loop_resp] * 10)
    text, msgs = asyncio.run(
        llm_service.run_agent([{"role": "user", "content": "hi"}], _noop_executor, max_iter=3)
    )
    assert "couldn't complete" in text
    assert msgs[-1]["role"] == "assistant"
    assert msgs[-1]["content"] == text
