"""
Firebase Authentication for the backend.

Verifies Firebase ID tokens (RS256 JWTs) against Google's public
securetoken certificates — no service-account key or firebase-admin
SDK required, so this works on the free Spark plan and in any
container with outbound HTTPS.

Flow:  frontend obtains an ID token from the Firebase JS SDK and sends
       `Authorization: Bearer <token>`; we verify signature, audience
       (project id), issuer, and expiry, then expose the user to route
       handlers via the `get_current_user` dependency.
"""
import logging
import re
import threading
import time

import jwt
import requests
from cryptography.x509 import load_pem_x509_certificate
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

logger = logging.getLogger(__name__)

GOOGLE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)

ROLE_PATIENT = "patient"
ROLE_DOCTOR  = "doctor"
ROLE_ADMIN   = "admin"

_bearer = HTTPBearer(auto_error=False)

# ── Google public-key cache (refreshed per Cache-Control max-age) ──
# Cache the PARSED public keys, not the raw PEM — parsing an X.509 cert per
# request is needless CPU on the hot auth path.
_certs_lock = threading.Lock()
_public_keys: dict = {}
_certs_expiry: float = 0.0


def _get_public_keys() -> dict:
    global _public_keys, _certs_expiry
    with _certs_lock:
        if _public_keys and time.time() < _certs_expiry:
            return _public_keys
        resp = requests.get(GOOGLE_CERTS_URL, timeout=10)
        resp.raise_for_status()
        _public_keys = {
            kid: load_pem_x509_certificate(pem.encode()).public_key()
            for kid, pem in resp.json().items()
        }
        max_age = 3600
        m = re.search(r"max-age=(\d+)", resp.headers.get("Cache-Control", ""))
        if m:
            max_age = int(m.group(1))
        _certs_expiry = time.time() + max_age
        return _public_keys


def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token. Returns the decoded claims or raises 401."""
    project_id = settings.FIREBASE_PROJECT_ID
    if not project_id:
        # Misconfiguration is a server problem, not the caller's.
        logger.error("FIREBASE_PROJECT_ID is not set — cannot verify tokens.")
        raise HTTPException(status_code=503, detail="Authentication is not configured.")

    try:
        keys = _get_public_keys()
    except requests.RequestException as exc:
        # Google's cert endpoint is unreachable — our dependency is down,
        # not the caller's token. 503 so clients retry instead of logging out.
        logger.error(f"Could not fetch Google signing certs: {exc}")
        raise HTTPException(
            status_code=503, detail="Authentication service temporarily unavailable."
        ) from exc

    try:
        kid = jwt.get_unverified_header(token).get("kid")
        public_key = keys.get(kid)
        if public_key is None:
            raise jwt.InvalidTokenError("Unknown key id")
        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.") from None
    except Exception as exc:
        logger.warning(f"Token verification failed: {exc}")
        raise HTTPException(status_code=401, detail="Invalid authentication token.") from exc

    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
    return claims


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency: the authenticated user for this request.
    Returns {uid, name, email, role}.
    """
    if settings.AUTH_DISABLED:
        # Explicit opt-out for local development / CI without Firebase.
        return {"uid": "dev-user", "name": "Dev User", "email": "dev@local", "role": ROLE_ADMIN}

    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = verify_firebase_token(creds.credentials)
    user = {
        "uid":   claims["sub"],
        "name":  claims.get("name") or "",
        "email": claims.get("email") or "",
        # Role comes from Firebase custom claims; everyone is a patient
        # unless explicitly promoted (see docs/auth section in README).
        "role":  claims.get("role", ROLE_PATIENT),
    }
    request.state.user = user
    return user


def require_role(*roles: str):
    """Dependency factory: allow only the given roles (admins always pass)."""
    async def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles and user["role"] != ROLE_ADMIN:
            raise HTTPException(status_code=403, detail="Insufficient permissions.")
        return user
    return _checker
