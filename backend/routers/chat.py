from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import logging

from core.metrics import CHAT_TURNS
from core.rate_limit import limiter
from database.database import get_db
from services.auth_service import get_current_user
from services.llm_service import run_agent, summarize_conversation
from services.memory_service import (
    get_session, append_to_session, replace_session, persist_text,
    compress_session_messages,
    get_patient_memory, update_patient_memory,
)
from services.stt_service import detect_language_from_text
from tools.appointment_tools import (
    check_availability, book_appointment,
    reschedule_appointment, cancel_appointment,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1, max_length=64)
    # Kept for backward compatibility; identity now comes from the
    # verified Firebase token, never from the client payload.
    patient_name: Optional[str] = Field(None, max_length=120)
    language: Optional[str] = None   # client-detected lang hint


class ChatResponse(BaseModel):
    response: str
    session_id: str
    language: str


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    response: Response,   # slowapi injects X-RateLimit headers here
    req: ChatRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Identity is server-derived from the verified token.
    patient_name = user["name"] or user["email"] or None
    try:
        # 1. Language detection
        lang = req.language or detect_language_from_text(req.message)

        # 2. Build user message, optionally injecting patient memory
        user_text = req.message
        if patient_name:
            mem = get_patient_memory(patient_name, db, uid=user["uid"])
            if mem and mem.get("preferred_doctor"):
                user_text += (
                    f"\n[Patient memory: {patient_name} "
                    f"usually sees {mem['preferred_doctor']}, "
                    f"preferred language: {mem.get('language', 'en')}]"
                )

        # 3. Load live session and append new user turn.
        # Session keys are scoped to the authenticated uid so one user
        # can never read or continue another user's conversation.
        session_key = f"{user['uid']}:{req.session_id}"
        await append_to_session(session_key, {"role": "user", "content": user_text}, db)
        persist_text(session_key, "user", req.message, db)

        # 4. Tool executor closure (captures db + patient name)
        REQUIRED_ARGS = {
            "check_availability":     ("doctor", "date"),
            "book_appointment":       ("name", "doctor", "date", "time"),
            "reschedule_appointment": ("appointment_id", "new_date", "new_time"),
            "cancel_appointment":     ("appointment_id",),
        }

        async def tool_executor(tool_name: str, args: dict):
            required = REQUIRED_ARGS.get(tool_name)
            if required is None:
                return {"error": f"Unknown tool: {tool_name}"}
            missing = [k for k in required if not args.get(k)]
            if missing:
                return {"error": f"Missing required arguments: {', '.join(missing)}. Ask the user for them."}

            if tool_name == "check_availability":
                return check_availability(args["doctor"], args["date"], db)

            if tool_name == "book_appointment":
                result = book_appointment(
                    args["name"], args["doctor"], args["date"], args["time"], db,
                    patient_uid=user["uid"],
                )
                if result.get("success") and patient_name:
                    update_patient_memory(patient_name, {
                        "preferred_doctor": args["doctor"],
                        "language": lang,
                        "last_appointment_id": result.get("appointment_id"),
                    }, db, uid=user["uid"])
                return result

            if tool_name == "reschedule_appointment":
                return reschedule_appointment(
                    args["appointment_id"], args["new_date"], args["new_time"], db
                )

            return cancel_appointment(args["appointment_id"], db)

        # 5. Run LLM agent
        current_messages = await get_session(session_key, db)
        response_text, updated = await run_agent(current_messages, tool_executor)

        # 6. Compress long histories into a summary, then store the
        #    updated transcript (tool calls included)
        updated = await compress_session_messages(updated, summarize_conversation)
        await replace_session(session_key, updated)

        # 7. Persist assistant reply
        persist_text(session_key, "assistant", response_text, db)

        CHAT_TURNS.labels(outcome="ok").inc()
        return ChatResponse(
            response=response_text,
            session_id=req.session_id,
            language=lang,
        )

    except Exception:
        CHAT_TURNS.labels(outcome="error").inc()
        logger.exception("Chat error")
        raise HTTPException(
            status_code=500,
            detail="The assistant hit an internal error. Please try again.",
        )
