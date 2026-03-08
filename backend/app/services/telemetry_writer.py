"""訂閱模擬器輸出，批次寫入 Telemetry。模擬器不依賴 DB，由此處寫入。"""
import asyncio
import time
from datetime import datetime
from typing import Any

from app.database import async_session
from app.models import Telemetry
from app.services.simulator import get_simulator

BATCH_SIZE = 30
FLUSH_INTERVAL_SEC = 3.0


def _packet_to_telemetry(packet: dict[str, Any]) -> Telemetry | None:
    if packet.get("session_id") is None:
        return None
    return Telemetry(
        session_id=packet["session_id"],
        lat=packet["lat"],
        lng=packet["lng"],
        alt=packet.get("alt", 0.0),
        speed=packet.get("speed", 0.0),
        heading=packet.get("heading", 0.0),
        battery=packet.get("battery", 100.0),
        wind_speed=packet.get("wind_speed", 0.0),
        wind_deg=packet.get("wind_deg", 0.0),
        effective_speed_m_min=packet.get("effective_speed_m_min", 0.0),
        created_at=datetime.utcnow(),
    )


async def _flush(buffer: list[Telemetry]) -> None:
    if not buffer:
        return
    async with async_session() as session:
        session.add_all(buffer)
        await session.commit()


async def run_telemetry_writer() -> None:
    """Background task: subscribe to simulator, batch and flush Telemetry to DB."""
    sim = get_simulator()
    queue = sim.subscribe()
    buffer: list[Telemetry] = []
    last_flush = time.monotonic()
    try:
        while True:
            try:
                packet = await asyncio.wait_for(queue.get(), timeout=FLUSH_INTERVAL_SEC)
            except asyncio.TimeoutError:
                pass
            else:
                rec = _packet_to_telemetry(packet)
                if rec is not None:
                    buffer.append(rec)
            now = time.monotonic()
            if len(buffer) >= BATCH_SIZE or (buffer and (now - last_flush) >= FLUSH_INTERVAL_SEC):
                await _flush(buffer)
                buffer = []
                last_flush = now
    except asyncio.CancelledError:
        if buffer:
            await _flush(buffer)
        raise
    finally:
        sim.unsubscribe(queue)
