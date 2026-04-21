from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging

from database.database import get_db
from services.llm_service import run_agent
from services.memory_service import (
    get_session, append_to_session, persist_text,
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
    message: str
    session_id: str
    patient_name: Optional[str] = None
    language: Optional[str] = None   # client-detected lang hint


class ChatResponse(BaseModel):
    response: str
    session_id: str
    language: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        # 1. Language detection
        lang = req.language or detect_language_from_text(req.message)

        # 2. Build user message, optionally injecting patient memory
        user_text = req.message
        if req.patient_name:
            mem = get_patient_memory(req.patient_name, db)
            if mem and mem.get("preferred_doctor"):
                user_text += (
                    f"\n[Patient memory: {req.patient_name} "
                    f"usually sees {mem['preferred_doctor']}, "
                    f"preferred language: {mem.get('language', 'en')}]"
                )

        # 3. Load live session and append new user turn
        history = get_session(req.session_id, db)
        append_to_session(req.session_id, {"role": "user", "content": user_text})
        persist_text(req.session_id, "user", req.message, db)

        # 4. Tool executor closure (captures db + patient name)
        async def tool_executor(tool_name: str, args: dict):
            if tool_name == "check_availability":
                return check_availability(args["doctor"], args["date"], db)

            elif tool_name == "book_appointment":
                result = book_appointment(
                    args["name"], args["doctor"], args["date"], args["time"], db
                )
                if result.get("success") and req.patient_name:
                    update_patient_memory(req.patient_name, {
                        "preferred_doctor": args["doctor"],
                        "language": lang,
                        "last_appointment_id": result.get("appointment_id"),
                    }, db)
                return result

            elif tool_name == "reschedule_appointment":
                return reschedule_appointment(
                    args["appointment_id"], args["new_date"], args["new_time"], db
                )

            elif tool_name == "cancel_appointment":
                return cancel_appointment(args["appointment_id"], db)

            return {"error": f"Unknown tool: {tool_name}"}

        # 5. Run LLM agent
        current_messages = get_session(req.session_id, db)
        response_text, updated = await run_agent(current_messages, tool_executor)

        # 6. Replace session with updated messages (tool calls included)
        from services.memory_service import _sessions
        _sessions[req.session_id] = updated

        # 7. Persist assistant reply
        persist_text(req.session_id, "assistant", response_text, db)

        return ChatResponse(
            response=response_text,
            session_id=req.session_id,
            language=lang,
        )

    except Exception as exc:
        logger.error(f"Chat error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
