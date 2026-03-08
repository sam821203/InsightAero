"""InsightAero API: FastAPI app with lifespan, CORS, and router registration."""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import CORS_ORIGINS
from app.database import async_session, init_db
from app.models import Drone, FlightSession, Task, TaskAssignment
from app.services.simulator import get_simulator
from app.services.telemetry_writer import run_telemetry_writer

from app.api.drones import router as drones_router
from app.api.tasks import router as tasks_router
from app.api.simulation import router as simulation_router
from app.api.flight_sessions import router as flight_sessions_router
from app.api.diagnose import router as diagnose_router
from app.api.websocket import router as websocket_router
from app.monitoring import init_monitoring

logger = logging.getLogger(__name__)


async def repair_flying_drones_at_startup() -> None:
    """On backend restart, set any leftover flying drones to idle and close their open sessions."""
    try:
        async with async_session() as session:
            result = await session.execute(select(Drone).where(Drone.status == "flying"))
            flying_drones = list(result.scalars().all())
            if not flying_drones:
                return
            flying_ids = [d.id for d in flying_drones]
            now = datetime.utcnow()
            for d in flying_drones:
                d.status = "idle"
            sessions_result = await session.execute(
                select(FlightSession).where(
                    FlightSession.drone_id.in_(flying_ids),
                    FlightSession.end_time.is_(None),
                )
            )
            open_sessions = sessions_result.scalars().all()
            open_session_ids = [s.id for s in open_sessions]
            for s in open_sessions:
                s.end_time = now
            if open_session_ids:
                assignments_result = await session.execute(
                    select(TaskAssignment).where(
                        TaskAssignment.flight_session_id.in_(open_session_ids)
                    )
                )
                assignments_list = list(assignments_result.scalars().all())
                for a in assignments_list:
                    a.status = "cancelled"
                task_ids = {a.task_id for a in assignments_list}
                for tid in task_ids:
                    task_result = await session.execute(select(Task).where(Task.id == tid))
                    t = task_result.scalar_one_or_none()
                    if t is not None:
                        t.status = "cancelled"
            await session.commit()
    except Exception as e:
        logger.exception("repair_flying_drones_at_startup failed: %s", e)
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_monitoring()
    await init_db()
    await repair_flying_drones_at_startup()
    writer_task = asyncio.create_task(run_telemetry_writer())
    yield
    writer_task.cancel()
    try:
        await writer_task
    except asyncio.CancelledError:
        pass
    get_simulator().stop()


app = FastAPI(title="InsightAero API", lifespan=lifespan)

# 有明確 CORS_ORIGINS 時才允許 credentials；否則用 * 且不帶 credentials（瀏覽器相容）
_origins = CORS_ORIGINS if CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=bool(CORS_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(drones_router)
app.include_router(tasks_router)
app.include_router(simulation_router)
app.include_router(flight_sessions_router)
app.include_router(diagnose_router)
app.include_router(websocket_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
