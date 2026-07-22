"""
WebRTC signaling for live voice sessions.

The browser POSTs an SDP offer (authenticated like every other
endpoint); we build an aiortc peer connection wired to a VoiceSession
and return the SDP answer. Media then flows peer-to-peer between the
browser and this process — audio over SRTP, transcripts and agent
events over a DataChannel. No third-party media server involved.
"""
import logging

from aiortc import (
    RTCConfiguration,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from config import settings
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


def _ice_servers() -> list[RTCIceServer]:
    """STUN (+ optional TURN) so aiortc can gather a routable candidate.
    Without this the backend offers only container-internal host candidates
    and live voice fails to connect for essentially all remote users."""
    servers: list[RTCIceServer] = []
    if settings.STUN_URL:
        servers.append(RTCIceServer(urls=[settings.STUN_URL]))
    turn = [u.strip() for u in settings.TURN_URLS.split(",") if u.strip()]
    if turn:
        servers.append(RTCIceServer(
            urls=turn,
            username=settings.TURN_USERNAME or None,
            credential=settings.TURN_CREDENTIAL or None,
        ))
    return servers


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

    pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=_ice_servers()))
    session = VoiceSession(user)
    register(session)
    logger.info("Live voice session %s started for uid=%s (%d active)",
                session.id, user["uid"], active_count())

    try:
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
    except Exception:
        # The connectionstatechange cleanup never fires if setup failed before
        # the connection was established — unregister here or the slot leaks
        # forever (MAX_LIVE_SESSIONS=4 → permanent 503 after a few bad offers).
        logger.exception("Live voice setup failed for session %s; releasing slot.", session.id)
        await unregister(session)
        await pc.close()
        raise HTTPException(status_code=400, detail="Could not establish the voice session.") from None

    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
        "session_id": session.id,
    }
