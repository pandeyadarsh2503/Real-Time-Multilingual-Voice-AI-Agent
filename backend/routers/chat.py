import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.metrics import CHAT_TURNS
from core.rate_limit import limiter
from database.database import get_db
from services.agent_runtime import run_chat_turn
from services.auth_service import get_current_user
from services.stt_service import detect_language_from_text

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
    try:
        lang = req.language or detect_language_from_text(req.message)
        response_text = await run_chat_turn(
            message=req.message,
            session_id=req.session_id,
            user=user,
            lang=lang,
            db=db,
        )
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
        ) from None
