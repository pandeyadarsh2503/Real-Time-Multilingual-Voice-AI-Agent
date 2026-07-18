"""
Shared rate limiter. In-process storage keyed by client IP — enough for
a single instance; swaps to Redis storage when Upstash lands so limits
hold across replicas.

Expensive AI endpoints declare stricter per-route limits with
`@limiter.limit(...)`; everything else falls under the default.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    headers_enabled=True,
)
