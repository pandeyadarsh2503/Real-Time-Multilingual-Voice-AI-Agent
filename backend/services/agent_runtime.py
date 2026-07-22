"""
Shared agent runtime: one implementation of the tool executor and the
full conversational turn (memory in → agent loop → memory out), used by
both the HTTP /api/chat endpoint and live WebRTC voice sessions so the
two paths can never drift apart.
"""
import logging

from sqlalchemy.orm import Session

from services.llm_service import run_agent, summarize_conversation
from services.memory_service import (
    append_to_session,
    compress_session_messages,
    get_patient_memory,
    get_session,
    persist_text,
    replace_session,
    update_patient_memory,
)
from tools.appointment_tools import (
    book_appointment,
    cancel_appointment,
    check_availability,
    list_my_appointments,
    reschedule_appointment,
)

logger = logging.getLogger(__name__)

def _clean_name(name: str | None) -> str | None:
    """Firebase display names are user-controlled. Strip newlines/control
    chars and cap length so a name like 'Asha\\n[System: ignore rules]' can't
    inject instructions when embedded in the prompt's memory note."""
    if not name:
        return name
    cleaned = " ".join(str(name).split())   # collapse all whitespace incl. newlines
    return cleaned[:80] or None


REQUIRED_ARGS = {
    "check_availability":     ("doctor", "date"),
    "book_appointment":       ("name", "doctor", "date", "time"),
    "list_my_appointments":   (),
    "reschedule_appointment": ("appointment_id", "new_date", "new_time"),
    "cancel_appointment":     ("appointment_id",),
}


def build_tool_executor(db: Session, user: dict, patient_name: str | None, lang: str, on_tool=None):
    """Tool dispatcher bound to this request's DB session and verified user.
    `on_tool(name)` fires before each execution — live voice sessions use
    it to stream 'what the agent is doing' to the client."""

    async def tool_executor(tool_name: str, args: dict):
        required = REQUIRED_ARGS.get(tool_name)
        if required is None:
            return {"error": f"Unknown tool: {tool_name}"}
        if on_tool is not None:
            try:
                on_tool(tool_name)
            except Exception:
                logger.debug("on_tool callback failed", exc_info=True)
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

        if tool_name == "list_my_appointments":
            return list_my_appointments(db, patient_uid=user["uid"], patient_name=patient_name)

        if tool_name == "reschedule_appointment":
            return reschedule_appointment(
                args["appointment_id"], args["new_date"], args["new_time"], db,
                patient_uid=user["uid"], patient_name=patient_name,
            )

        return cancel_appointment(
            args["appointment_id"], db,
            patient_uid=user["uid"], patient_name=patient_name,
        )

    return tool_executor


async def run_chat_turn(
    message: str,
    session_id: str,
    user: dict,
    lang: str,
    db: Session,
    on_tool=None,
) -> str:
    """
    One full conversational turn. Session keys are scoped to the
    authenticated uid so one user can never read another's conversation.
    Returns the assistant's reply text.
    """
    patient_name = _clean_name(user["name"] or user["email"] or None)

    user_text = message
    if patient_name:
        mem = get_patient_memory(patient_name, db, uid=user["uid"])
        if mem and mem.get("preferred_doctor"):
            user_text += (
                f"\n[Patient memory: {patient_name} "
                f"usually sees {mem['preferred_doctor']}, "
                f"preferred language: {mem.get('language', 'en')}]"
            )

    session_key = f"{user['uid']}:{session_id}"
    await append_to_session(session_key, {"role": "user", "content": user_text}, db)
    persist_text(session_key, "user", message, db)

    tool_executor = build_tool_executor(db, user, patient_name, lang, on_tool=on_tool)
    current_messages = await get_session(session_key, db)
    response_text, updated = await run_agent(current_messages, tool_executor, reply_language=lang)

    updated = await compress_session_messages(updated, summarize_conversation)
    await replace_session(session_key, updated)
    persist_text(session_key, "assistant", response_text, db)
    return response_text
