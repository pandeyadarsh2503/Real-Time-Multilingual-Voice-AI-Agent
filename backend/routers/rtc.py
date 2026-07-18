"""
WebRTC signaling for live voice sessions.

The browser POSTs an SDP offer (authenticated like every other
endpoint); we build an aiortc peer connection wired to a VoiceSession
and return the SDP answer. Media then flows peer-to-peer between the
browser and this process — audio over SRTP, transcripts and agent
events over a DataChannel. No third-party media server involved.
"""
import logging

from aiortc import RTCPeerConnection, RTCSessionDescription
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from core.rate_limit import limiter
from services.auth_service import get_current_user
from services.voice_stream_service import (
    MAX_LIVE_SESSIONS,
    VoiceSession,
    active_count,
    register,
    unregister,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class RTCOffer(BaseModel):
    sdp: str = Field(..., max_length=100_000)
    type: str = Field(..., pattern="^offer$")


@router.post("/voice/rtc/offer")
@limiter.limit("10/minute")
async def rtc_offer(
    request: Request,
    response: Response,   # slowapi header injection
    offer: RTCOffer,
    user: dict = Depends(get_current_user),
):
    if active_count() >= MAX_LIVE_SESSIONS:
        raise HTTPException(status_code=503, detail="All live voice slots are busy. Please try again shortly.")

    pc = RTCPeerConnection()
    session = VoiceSession(user)
    register(session)
    logger.info("Live voice session %s started for uid=%s (%d active)",
                session.id, user["uid"], active_count())

    # Outbound agent audio must be on the connection before answering.
    pc.addTrack(session.outbound)

    @pc.on("datachannel")
    def on_datachannel(channel):
        session.attach_channel(channel)

    @pc.on("track")
    def on_track(track):
        if track.kind == "audio":
            session.start(track)

    @pc.on("connectionstatechange")
    async def on_state_change():
        if pc.connectionState in ("failed", "closed", "disconnected"):
            logger.info("Live voice session %s ended (%s)", session.id, pc.connectionState)
            await unregister(session)
            await pc.close()

    await pc.setRemoteDescription(RTCSessionDescription(sdp=offer.sdp, type=offer.type))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
        "session_id": session.id,
    }
