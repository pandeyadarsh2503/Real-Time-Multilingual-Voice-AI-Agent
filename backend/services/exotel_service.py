"""
Exotel outbound call integration.
Docs: https://developer.exotel.com/api/
"""
import logging
import requests
from requests.auth import HTTPBasicAuth
from config import settings

logger = logging.getLogger(__name__)

EXOTEL_BASE = "https://api.exotel.in/v1/Accounts"   # Indian endpoint


def initiate_reminder_call(
    phone: str,
    patient_name: str,
    doctor: str,
    appt_date: str,
    appt_time: str,
) -> dict:
    """
    Trigger a Click-to-Call reminder via Exotel.
    Exotel connects the clinic → patient and plays a recorded/TTS message.
    """
    if not all([settings.EXOTEL_API_KEY, settings.EXOTEL_API_TOKEN, settings.EXOTEL_SID]):
        logger.warning("Exotel credentials not configured — skipping live call.")
        return {"success": False, "error": "Exotel not configured"}

    url = f"{EXOTEL_BASE}/{settings.EXOTEL_SID}/Calls/connect.json"

    # Exotel expects From = patient, To = caller_id (virtual number)
    payload = {
        "From":         phone,
        "To":           settings.EXOTEL_CALLER_ID,
        "CallerId":     settings.EXOTEL_CALLER_ID,
        "TimeLimit":    120,                              # max call duration (s)
        "Record":       "false",
        "StatusCallback": "https://your-domain.ngrok.io/api/outbound/webhook",
        # Custom field passed through for webhook correlation
        "CustomField":  f"{patient_name}|{doctor}|{appt_date}|{appt_time}",
    }

    try:
        resp = requests.post(
            url,
            auth=HTTPBasicAuth(settings.EXOTEL_API_KEY, settings.EXOTEL_API_TOKEN),
            data=payload,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            call_sid = data.get("Call", {}).get("Sid", "")
            logger.info(f"Exotel call initiated: SID={call_sid}")
            return {"success": True, "call_sid": call_sid}
        else:
            logger.error(f"Exotel error {resp.status_code}: {resp.text}")
            return {"success": False, "error": resp.text}
    except Exception as exc:
        logger.error(f"Exotel exception: {exc}")
        return {"success": False, "error": str(exc)}


def get_call_status(call_sid: str) -> dict:
    """Fetch the status of an existing Exotel call."""
    url = f"{EXOTEL_BASE}/{settings.EXOTEL_SID}/Calls/{call_sid}.json"
    try:
        resp = requests.get(
            url,
            auth=HTTPBasicAuth(settings.EXOTEL_API_KEY, settings.EXOTEL_API_TOKEN),
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        return {"error": resp.text}
    except Exception as exc:
        return {"error": str(exc)}
