"""Monitoring integration: Sentry and Datadog placeholders. Call init_monitoring() from app lifespan."""
import logging
import os

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    """Initialize Sentry SDK if SENTRY_DSN is set. Safe to call when not configured."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.asyncio import AsyncioIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0")),
            integrations=[FastApiIntegration(), AsyncioIntegration()],
        )
        logger.info("Sentry initialized")
    except ImportError:
        logger.warning("sentry_sdk not installed; set SENTRY_DSN and install sentry-sdk to enable")
    except Exception as e:
        logger.warning("Sentry init failed: %s", e)


def init_datadog() -> None:
    """Placeholder for Datadog APM. Set DD_API_KEY and install ddtrace to enable."""
    if not os.getenv("DD_API_KEY"):
        return
    try:
        import ddtrace
        ddtrace.patch_all()
        logger.info("Datadog tracer patch applied")
    except ImportError:
        logger.warning("ddtrace not installed; set DD_API_KEY and install ddtrace to enable")
    except Exception as e:
        logger.warning("Datadog init failed: %s", e)


def init_monitoring() -> None:
    """Call from FastAPI lifespan to enable Sentry and/or Datadog."""
    init_sentry()
    init_datadog()
