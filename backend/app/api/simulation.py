"""Simulation control API."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Drone, FlightSession, Task, TaskAssignment
from app.schemas.simulation import (
    SimulationStartBody,
    SimulationStartResponse,
    SimulationStatusResponse,
)
from app.services.run_state import (
    clear_current_run,
    get_all_runs,
    get_current_run,
    set_current_run,
)
from app.services.simulator import get_simulator
from app.services.task_handlers import (
    on_simulation_arrival,
    update_drone_last_positions_on_cancel,
)

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.post("/start", response_model=SimulationStartResponse)
async def simulation_start(
    db: Annotated[AsyncSession, Depends(get_db)],
    body: SimulationStartBody | None = None,
):
    if get_simulator().is_running:
        task_id, pairs = get_current_run()
        if pairs:
            run_drone_ids = [p[0] for p in pairs]
            run_session_ids = [p[1] for p in pairs]
            now = datetime.utcnow()
            sessions = await db.execute(
                select(FlightSession).where(FlightSession.id.in_(run_session_ids))
            )
            for s in sessions.scalars().all():
                s.end_time = now
            if task_id is not None:
                assignments_result = await db.execute(
                    select(TaskAssignment).where(
                        TaskAssignment.flight_session_id.in_(run_session_ids)
                    )
                )
                for a in assignments_result.scalars().all():
                    a.status = "cancelled"
                task_result = await db.execute(select(Task).where(Task.id == task_id))
                task = task_result.scalar_one_or_none()
                if task is not None:
                    task.status = "cancelled"
            drones = await db.execute(select(Drone).where(Drone.id.in_(run_drone_ids)))
            for d in drones.scalars().all():
                d.status = "idle"
            await db.commit()
            clear_current_run()
        get_simulator().stop()

    body = body or SimulationStartBody()
    drone_ids: list[int] = []
    session_ids: list[int] = []

    if body.drone_ids is not None and len(body.drone_ids) > 0:
        result = await db.execute(select(Drone).where(Drone.id.in_(body.drone_ids)))
        drones = result.scalars().all()
        idle_drones = [d for d in drones if d.status == "idle"]
        if not idle_drones:
            raise HTTPException(
                status_code=400,
                detail="No idle drones found for given drone_ids, or ids invalid.",
            )
        for drone in idle_drones:
            drone.status = "flying"
            drone_ids.append(drone.id)
            session = FlightSession(drone_id=drone.id)
            db.add(session)
            await db.flush()
            session_ids.append(session.id)
    else:
        drone_count = body.drone_count if body.drone_count is not None else 1
        if drone_count < 1:
            drone_count = 1
        for i in range(drone_count):
            name = f"Drone-{i + 1}"
            result = await db.execute(select(Drone).where(Drone.name == name))
            drone = result.scalar_one_or_none()
            if drone is None:
                drone = Drone(name=name, status="flying")
                db.add(drone)
                await db.flush()
            else:
                drone.status = "flying"
            drone_ids.append(drone.id)
            session = FlightSession(drone_id=drone.id)
            db.add(session)
            await db.flush()
            session_ids.append(session.id)

    await db.commit()
    set_current_run(None, list(zip(drone_ids, session_ids)))
    on_arrival = (
        on_simulation_arrival
        if (body.dest_lat is not None and body.dest_lng is not None)
        else None
    )
    get_simulator().start(
        drone_session_pairs=list(zip(drone_ids, session_ids)),
        start_lat=body.start_lat,
        start_lng=body.start_lng,
        dest_lat=body.dest_lat,
        dest_lng=body.dest_lng,
        on_arrival=on_arrival,
    )
    return SimulationStartResponse(
        status="started",
        session_ids=session_ids,
        drone_ids=drone_ids,
    )


@router.post("/stop", response_model=SimulationStatusResponse)
async def simulation_stop(db: Annotated[AsyncSession, Depends(get_db)]):
    all_runs = get_all_runs()
    now = datetime.utcnow()
    for task_id, pairs in all_runs.items():
        if not pairs:
            continue
        drone_ids = [p[0] for p in pairs]
        session_ids = [p[1] for p in pairs]
        sessions = await db.execute(
            select(FlightSession).where(FlightSession.id.in_(session_ids))
        )
        for s in sessions.scalars().all():
            s.end_time = now
        if task_id is not None:
            assignments_result = await db.execute(
                select(TaskAssignment).where(
                    TaskAssignment.flight_session_id.in_(session_ids)
                )
            )
            assignments_list = list(assignments_result.scalars().all())
            for a in assignments_list:
                a.status = "cancelled"
            task_result = await db.execute(select(Task).where(Task.id == task_id))
            task = task_result.scalar_one_or_none()
            if task is not None:
                task.status = "cancelled"
            position_by_drone = await update_drone_last_positions_on_cancel(
                db, assignments_list
            )
        else:
            assignments_result = await db.execute(
                select(TaskAssignment).where(
                    TaskAssignment.flight_session_id.in_(session_ids)
                )
            )
            assignments_list = list(assignments_result.scalars().all())
            position_by_drone = await update_drone_last_positions_on_cancel(
                db, assignments_list
            )
        drones = await db.execute(select(Drone).where(Drone.id.in_(drone_ids)))
        for d in drones.scalars().all():
            if d.id in position_by_drone:
                d.last_lat, d.last_lng = position_by_drone[d.id]
            d.status = "idle"
    if all_runs:
        await db.commit()
        clear_current_run()
    get_simulator().stop()
    return SimulationStatusResponse(status="stopped")


@router.post("/pause", response_model=SimulationStatusResponse)
async def simulation_pause():
    if get_simulator().is_running:
        get_simulator().pause()
    return SimulationStatusResponse(status="paused")


@router.post("/resume", response_model=SimulationStatusResponse)
async def simulation_resume():
    if get_simulator().is_running:
        get_simulator().resume()
    return SimulationStatusResponse(status="resumed")
