"""
Tests for the session memory layer: TTL semantics of the in-process
store, DB restoration, retention pruning, and safe context compression.
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import settings
from database.database import Base
from database.models import Memory
from services import memory_service as ms


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def fresh_store():
    ms.store = ms.InMemorySessionStore()
    yield


def test_append_and_get_roundtrip(db):
    run(ms.append_to_session("u1:s1", {"role": "user", "content": "hi"}, db))
    run(ms.append_to_session("u1:s1", {"role": "assistant", "content": "hello"}, db))
    msgs = run(ms.get_session("u1:s1", db))
    assert [m["content"] for m in msgs] == ["hi", "hello"]


def test_ttl_expiry_drops_session(db, monkeypatch):
    monkeypatch.setattr(settings, "SESSION_TTL_SECONDS", 0)
    run(ms.append_to_session("u1:s1", {"role": "user", "content": "hi"}, db))
    # TTL of 0 expires immediately; nothing was persisted to SQL for
    # this role-only store call beyond what we wrote, so it's empty.
    msgs = run(ms.get_session("u1:s1", db))
    assert msgs == []


def test_restore_from_db_after_expiry(db):
    for i in range(3):
        ms.persist_text("u1:s1", "user", f"turn {i}", db)
    msgs = run(ms.get_session("u1:s1", db))  # cache miss → restored from SQL
    assert [m["content"] for m in msgs] == ["turn 0", "turn 1", "turn 2"]


def test_restore_takes_newest_turns(db):
    for i in range(ms.MAX_DB_HISTORY + 5):
        ms.persist_text("u1:s1", "user", f"turn {i}", db)
    msgs = run(ms.get_session("u1:s1", db))
    assert len(msgs) == ms.MAX_DB_HISTORY
    assert msgs[-1]["content"] == f"turn {ms.MAX_DB_HISTORY + 4}"


def test_sessions_are_isolated(db):
    run(ms.append_to_session("u1:s1", {"role": "user", "content": "mine"}, db))
    assert run(ms.get_session("u2:s1", db)) == []


def test_prune_old_memory(db):
    old = Memory(session_id="s", role="user", content="ancient")
    old.timestamp = datetime.now(timezone.utc) - timedelta(days=90)
    db.add(old)
    db.add(Memory(session_id="s", role="user", content="recent"))
    db.commit()
    deleted = ms.prune_old_memory(db)
    assert deleted == 1
    assert db.query(Memory).count() == 1


# ── Compression ────────────────────────────────────────────

async def fake_summarizer(messages):
    return f"{len(messages)} turns summarized"


def _long_history(n):
    msgs = []
    for i in range(n // 2):
        msgs.append({"role": "user", "content": f"q{i}"})
        msgs.append({"role": "assistant", "content": f"a{i}"})
    return msgs


def test_short_history_not_compressed():
    msgs = _long_history(10)
    out = run(ms.compress_session_messages(msgs, fake_summarizer))
    assert out == msgs


def test_long_history_compressed_with_summary_head():
    msgs = _long_history(40)
    out = run(ms.compress_session_messages(msgs, fake_summarizer))
    assert len(out) < len(msgs)
    assert out[0]["role"] == "system"
    assert "summarized" in out[0]["content"]
    # recent turns kept verbatim and start at a user turn
    assert out[1]["role"] == "user"
    assert out[-1] == msgs[-1]


def test_compression_never_orphans_tool_pairs():
    msgs = _long_history(30)
    # a tool exchange right at the naive cut boundary
    msgs += [
        {"role": "user", "content": "book it"},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "t1"}]},
        {"role": "tool", "tool_call_id": "t1", "content": "{}"},
        {"role": "assistant", "content": "done"},
    ] + _long_history(6)
    out = run(ms.compress_session_messages(msgs, fake_summarizer))
    # every tool message kept must be preceded (somewhere after the
    # summary) by the assistant message carrying its tool_calls
    for i, m in enumerate(out):
        if m.get("role") == "tool":
            assert any(
                "tool_calls" in prev for prev in out[1:i]
            ), "tool result kept without its tool_call"


def test_summarizer_failure_keeps_history():
    async def broken(_):
        raise RuntimeError("groq down")
    msgs = _long_history(40)
    out = run(ms.compress_session_messages(msgs, broken))
    assert out == msgs


# ── Redis store (fakeredis — same wire behavior incl. GETEX/TTL) ──

def test_redis_store_roundtrip_ttl_and_delete(db):
    from fakeredis import FakeAsyncRedis

    async def scenario():
        store = ms.RedisSessionStore(client=FakeAsyncRedis(decode_responses=True))
        payload = [
            {"role": "user", "content": "नमस्ते"},
            {"role": "assistant", "content": None, "tool_calls": [{"id": "t1"}]},
        ]
        await store.set("u1:s1", payload)
        msgs = await store.get("u1:s1")
        assert msgs == payload                       # Unicode + tool calls survive JSON
        ttl = await store._redis.ttl("session:u1:s1")
        assert 0 < ttl <= settings.SESSION_TTL_SECONDS
        assert await store.get("missing") is None
        await store.delete("u1:s1")
        assert await store.get("u1:s1") is None

    run(scenario())


def test_redis_store_backs_full_session_api(db):
    from fakeredis import FakeAsyncRedis

    async def scenario():
        # single event loop: fakeredis clients bind to the loop they're created in
        ms.store = ms.RedisSessionStore(client=FakeAsyncRedis(decode_responses=True))
        await ms.append_to_session("u1:s1", {"role": "user", "content": "hi"}, db)
        await ms.append_to_session("u1:s1", {"role": "assistant", "content": "hello"}, db)
        msgs = await ms.get_session("u1:s1", db)
        assert [m["content"] for m in msgs] == ["hi", "hello"]
        assert await ms.get_session("u2:other", db) == []

    run(scenario())
