"""
Hybrid memory strategy:
  - In-process dict  → full message list (including tool call objects) for live sessions
  - SQLite (Memory)  → user/assistant text only, for restoring context after restarts
"""
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from database.models import Memory, Patient

MAX_DB_HISTORY = 20   # turns to restore from DB
MAX_SESSION    = 40   # max messages kept in RAM per session

# ── In-memory store: session_id → list[dict] ──────────────
_sessions: Dict[str, List[dict]] = {}


# ── Session helpers ────────────────────────────────────────

def get_session(session_id: str, db: Session) -> List[dict]:
    """Return the live message list for this session. Seeds from DB if first access."""
    if session_id not in _sessions:
        rows = (
            db.query(Memory)
            .filter(Memory.session_id == session_id)
            .order_by(Memory.timestamp)
            .limit(MAX_DB_HISTORY)
            .all()
        )
        _sessions[session_id] = [
            {"role": r.role, "content": r.content} for r in rows
        ]
    return _sessions[session_id]


def append_to_session(session_id: str, message: dict):
    """Append a message dict to the in-memory session (handles tool-call objects too)."""
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append(message)
    # Trim to window
    if len(_sessions[session_id]) > MAX_SESSION:
        _sessions[session_id] = _sessions[session_id][-MAX_SESSION:]


def persist_text(session_id: str, role: str, content: str, db: Session):
    """Write a plain text turn to SQLite for cross-restart persistence."""
    db.add(Memory(session_id=session_id, role=role, content=content))
    db.commit()


def clear_session(session_id: str, db: Session):
    _sessions.pop(session_id, None)
    db.query(Memory).filter(Memory.session_id == session_id).delete()
    db.commit()


# ── Patient long-term memory ───────────────────────────────

def get_patient_memory(name: str, db: Session) -> Optional[dict]:
    p = db.query(Patient).filter(Patient.name == name).first()
    if not p:
        return None
    return {
        "name": p.name,
        "preferred_doctor": p.preferred_doctor,
        "language": p.language,
        "last_appointment_id": p.last_appointment_id,
    }


def update_patient_memory(name: str, updates: dict, db: Session):
    p = db.query(Patient).filter(Patient.name == name).first()
    if not p:
        p = Patient(name=name)
        db.add(p)
    for k, v in updates.items():
        if hasattr(p, k) and v is not None:
            setattr(p, k, v)
    db.commit()
