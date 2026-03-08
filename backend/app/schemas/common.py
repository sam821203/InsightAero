"""Common response fields and base schemas."""
from datetime import datetime


def datetime_iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None
