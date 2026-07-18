"""
Shared rate limiter, keyed by client IP.

Storage: Redis when REDIS_URL is set — limits then hold across
processes and replicas (Upstash free tier works). Falls back to
in-process memory for zero-setup local development.

Expensive AI endpoints declare stricter per-route limits with
`@limiter.limit(...)`; everything else falls under the default.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    headers_enabled=True,
    storage_uri=settings.REDIS_URL or "memory://",
)
