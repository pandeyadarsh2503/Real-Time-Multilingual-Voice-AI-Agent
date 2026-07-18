"""
Conversation memory.

Three layers, each with a distinct job:

  1. Session store (Redis when REDIS_URL is set, in-process fallback):
     the live message list including tool-call objects, JSON-encoded,
     with a *sliding* TTL — an active conversation never expires
     mid-flow, an abandoned one cleans itself up. Redis makes sessions
     survive restarts and work across replicas; the fallback keeps
     local dev zero-setup.
  2. SQL `memory` table: plain user/assistant text turns, used to
     restore context after the session TTL has expired, and pruned
     after MEMORY_RETENTION_DAYS.
  3. `patients` table: long-term structured preferences (preferred
     doctor, language), keyed by Firebase uid with name fallback.

Long conversations are compressed: once the message list crosses
COMPRESS_AFTER, everything but the most recent turns is folded into a
single summary message (produced by the LLM) so the prompt stays small
and old context survives as a digest instead of being truncated away.
"""
import json
import logging
import time
from typing import Awaitable, Callable, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from config import settings
from database.models import Memory, Patient

logger = logging.getLogger(__name__)

MAX_DB_HISTORY = 20    # turns restored from SQL after a session expires
MAX_SESSION    = 60    # hard cap on messages kept per live session
COMPRESS_AFTER = 30    # compress once the session grows past this
KEEP_RECENT    = 10    # turns kept verbatim when compressing


# ── Session stores ─────────────────────────────────────────

class InMemorySessionStore:
    """Dev fallback: per-process dict with the same TTL semantics as Redis."""

    def __init__(self):
        self._data: Dict[str, Tuple[float, List[dict]]] = {}

    def _prune(self):
        now = time.monotonic()
        for key in [k for k, (exp, _) in self._data.items() if exp <= now]:
            del self._data[key]

    async def get(self, key: str) -> Optional[List[dict]]:
        self._prune()
        entry = self._data.get(key)
        if entry is None:
            return None
        # Sliding TTL: touching a session keeps it alive.
        self._data[key] = (time.monotonic() + settings.SESSION_TTL_SECONDS, entry[1])
        return entry[1]

    async def set(self, key: str, messages: List[dict]):
        self._prune()
        self._data[key] = (time.monotonic() + settings.SESSION_TTL_SECONDS, messages)

    async def delete(self, key: str):
        self._data.pop(key, None)


class RedisSessionStore:
    """Redis (Upstash) store — async client, JSON values, SETEX TTL."""

    def __init__(self, url: str = "", client=None):
        if client is not None:      # test injection point
            self._redis = client
        else:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                url, decode_responses=True, socket_timeout=5, socket_connect_timeout=5
            )

    @staticmethod
    def _key(key: str) -> str:
        return f"session:{key}"

    async def get(self, key: str) -> Optional[List[dict]]:
        raw = await self._redis.getex(self._key(key), ex=settings.SESSION_TTL_SECONDS)
        return json.loads(raw) if raw else None

    async def set(self, key: str, messages: List[dict]):
        await self._redis.setex(
            self._key(key),
            settings.SESSION_TTL_SECONDS,
            json.dumps(messages, ensure_ascii=False),
        )

    async def delete(self, key: str):
        await self._redis.delete(self._key(key))


def _build_store():
    if settings.REDIS_URL:
        logger.info("Session store: Redis")
        return RedisSessionStore(settings.REDIS_URL)
    logger.info("Session store: in-process (set REDIS_URL for Redis)")
    return InMemorySessionStore()


store = _build_store()


# ── Session API (used by the chat router) ──────────────────

async def get_session(session_key: str, db: Session) -> List[dict]:
    """Live message list for this session; restores from SQL on a miss."""
    cached = await store.get(session_key)
    if cached is not None:
        return cached

    rows = (
        db.query(Memory)
        .filter(Memory.session_id == session_key)
        .order_by(Memory.timestamp.desc(), Memory.id.desc())
        .limit(MAX_DB_HISTORY)
        .all()
    )
    messages = [{"role": r.role, "content": r.content} for r in reversed(rows)]
    await store.set(session_key, messages)
    return messages


async def append_to_session(session_key: str, message: dict, db: Session):
    messages = await get_session(session_key, db)
    messages.append(message)
    await store.set(session_key, messages[-MAX_SESSION:])


async def replace_session(session_key: str, messages: List[dict]):
    await store.set(session_key, messages[-MAX_SESSION:])


async def clear_session(session_key: str, db: Session):
    await store.delete(session_key)
    db.query(Memory).filter(Memory.session_id == session_key).delete()
    db.commit()


def persist_text(session_key: str, role: str, content: str, db: Session):
    """Write a plain text turn to SQL for restoration after TTL expiry."""
    db.add(Memory(session_id=session_key, role=role, content=content))
    db.commit()


def prune_old_memory(db: Session) -> int:
    """Delete persisted turns older than the retention window."""
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.MEMORY_RETENTION_DAYS)
    deleted = db.query(Memory).filter(Memory.timestamp < cutoff).delete()
    db.commit()
    return deleted


# ── Context compression ────────────────────────────────────

def _clean_cut_index(messages: List[dict]) -> int:
    """
    First index at or after (len - KEEP_RECENT) where a user turn starts.
    Cutting there can never orphan an assistant tool_call / tool-result
    pair. Returns -1 when no safe boundary exists.
    """
    target = len(messages) - KEEP_RECENT
    for i in range(target, len(messages)):
        if messages[i].get("role") == "user":
            return i
    return -1


async def compress_session_messages(
    messages: List[dict],
    summarize: Callable[[List[dict]], Awaitable[str]],
) -> List[dict]:
    """
    Fold everything before the last few turns into one summary message.
    On any summarizer failure the messages are returned untouched —
    compression is an optimisation, never a point of failure.
    """
    if len(messages) <= COMPRESS_AFTER:
        return messages
    cut = _clean_cut_index(messages)
    if cut <= 1:
        return messages
    try:
        summary = await summarize(messages[:cut])
    except Exception:
        logger.exception("Conversation summarization failed; keeping full history")
        return messages
    if not summary:
        return messages
    return [
        {"role": "system", "content": f"Summary of the earlier conversation: {summary}"}
    ] + messages[cut:]


# ── Patient long-term memory ───────────────────────────────
# Looked up by Firebase uid when available (the stable identity);
# name is the fallback for legacy rows created before authentication.

def _find_patient(name: str, db: Session, uid: Optional[str] = None) -> Optional[Patient]:
    if uid:
        p = db.query(Patient).filter(Patient.uid == uid).first()
        if p:
            return p
    return db.query(Patient).filter(Patient.name == name).first()


def get_patient_memory(name: str, db: Session, uid: Optional[str] = None) -> Optional[dict]:
    p = _find_patient(name, db, uid)
    if not p:
        return None
    return {
        "name": p.name,
        "preferred_doctor": p.preferred_doctor,
        "language": p.language,
        "last_appointment_id": p.last_appointment_id,
    }


def update_patient_memory(name: str, updates: dict, db: Session, uid: Optional[str] = None):
    p = _find_patient(name, db, uid)
    if not p:
        p = Patient(name=name)
        db.add(p)
    if uid and not p.uid:
        p.uid = uid
    for k, v in updates.items():
        if hasattr(p, k) and v is not None:
            setattr(p, k, v)
    db.commit()
