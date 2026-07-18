"""
Application metrics (prometheus_client registry, exposed at /metrics).

HTTP-level latency/throughput comes from prometheus-fastapi-
instrumentator; the metrics here cover what that can't see — the AI
pipeline stages and agent tool usage — so latency dashboards can break
a slow request down into LLM vs STT vs TTS time.
"""
from prometheus_client import Counter, Histogram

_AI_BUCKETS = (0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0, 30.0)

LLM_LATENCY = Histogram(
    "swasthya_llm_request_seconds",
    "Latency of individual Groq chat-completion calls",
    buckets=_AI_BUCKETS,
)

STT_LATENCY = Histogram(
    "swasthya_stt_seconds",
    "Latency of Whisper transcriptions",
    buckets=_AI_BUCKETS,
)

TTS_LATENCY = Histogram(
    "swasthya_tts_seconds",
    "Latency of speech synthesis",
    buckets=_AI_BUCKETS,
)

TOOL_CALLS = Counter(
    "swasthya_agent_tool_calls_total",
    "Agent tool invocations",
    labelnames=("tool", "outcome"),   # outcome: success | error
)

CHAT_TURNS = Counter(
    "swasthya_chat_turns_total",
    "Completed chat turns",
    labelnames=("outcome",),          # outcome: ok | error
)
