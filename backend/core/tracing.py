"""
Optional OpenTelemetry tracing.

Off by default; enabled by setting OTEL_EXPORTER_OTLP_ENDPOINT (e.g.
the Grafana Cloud OTLP gateway, free tier) plus the auth header in
OTEL_EXPORTER_OTLP_HEADERS. Uses the standard OTLP/HTTP exporter, so
any OTel-compatible backend works — nothing here is vendor-specific.
"""
import logging
import os

from config import settings

logger = logging.getLogger(__name__)


def init_tracing(app) -> bool:
    if not settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning("OTEL endpoint configured but opentelemetry packages missing.")
        return False

    # The exporter reads standard OTEL_* env vars; settings may come
    # from .env, which pydantic does NOT export — push them through.
    os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", settings.OTEL_EXPORTER_OTLP_ENDPOINT)
    if settings.OTEL_EXPORTER_OTLP_HEADERS:
        os.environ.setdefault("OTEL_EXPORTER_OTLP_HEADERS", settings.OTEL_EXPORTER_OTLP_HEADERS)

    provider = TracerProvider(
        resource=Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
    )
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")
    logger.info("OpenTelemetry tracing enabled → %s", settings.OTEL_EXPORTER_OTLP_ENDPOINT)
    return True
