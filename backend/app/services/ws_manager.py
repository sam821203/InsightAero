"""WebSocket connection manager: centralizes subscriber list and broadcast from simulator."""
import asyncio
import json
import logging
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections subscribed to telemetry broadcast from simulator."""

    def __init__(self) -> None:
        self._connections: list[tuple[Any, asyncio.Queue]] = []
        self._lock = asyncio.Lock()

    async def subscribe(
        self,
        websocket: Any,
        get_queue: Callable[[], asyncio.Queue[dict[str, Any]]],
        unsubscribe: Callable[[asyncio.Queue[dict[str, Any]]], None] | None = None,
    ) -> None:
        """Register a WebSocket and forward packets from the simulator queue until disconnect."""
        queue = get_queue()
        async with self._lock:
            self._connections.append((websocket, queue))
        try:
            while True:
                packet = await queue.get()
                try:
                    await websocket.send_text(json.dumps(packet))
                except Exception as e:
                    logger.warning("ws send failed: %s", e)
                    break
        finally:
            if unsubscribe is not None:
                unsubscribe(queue)
            async with self._lock:
                self._connections[:] = [
                    (w, q) for w, q in self._connections if w != websocket
                ]

    @property
    def connection_count(self) -> int:
        return len(self._connections)
