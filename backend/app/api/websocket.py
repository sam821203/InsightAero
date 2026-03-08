"""WebSocket telemetry endpoint."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.simulator import get_simulator
from app.services.ws_manager import ConnectionManager

router = APIRouter(tags=["websocket"])
_ws_manager: ConnectionManager | None = None


def get_ws_manager() -> ConnectionManager:
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = ConnectionManager()
    return _ws_manager


@router.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await websocket.accept()
    sim = get_simulator()
    manager = get_ws_manager()
    try:
        await manager.subscribe(
            websocket,
            get_queue=sim.subscribe,
            unsubscribe=sim.unsubscribe,
        )
    except WebSocketDisconnect:
        pass
