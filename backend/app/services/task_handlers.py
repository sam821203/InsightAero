"""Task/simulation lifecycle callbacks: arrival, low-battery, cancel position updates."""
import asyncio
from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Drone, FlightSession, Task, TaskAssignment, TaskReport, Telemetry
from app.services.run_state import clear_current_run, get_current_run, remove_task_run
from app.services.simulator import get_simulator
from app.services.task_report import run_task_report_pipeline


async def on_simulation_arrival() -> None:
    """抵達終點時由模擬器觸發：更新 DB（session 結束、無人機 idle）並停止模擬器。"""
    task_id, pairs = get_current_run()
    if pairs:
        run_drone_ids = [p[0] for p in pairs]
        run_session_ids = [p[1] for p in pairs]
        now = datetime.utcnow()
        async with async_session() as session:
            sessions_result = await session.execute(
                select(FlightSession).where(FlightSession.id.in_(run_session_ids))
            )
            for s in sessions_result.scalars().all():
                s.end_time = now
            if task_id is not None:
                assignments_result = await session.execute(
                    select(TaskAssignment).where(
                        TaskAssignment.flight_session_id.in_(run_session_ids)
                    )
                )
                for a in assignments_result.scalars().all():
                    a.status = "arrived"
                task_result = await session.execute(select(Task).where(Task.id == task_id))
                task = task_result.scalar_one_or_none()
                if task is not None:
                    task.status = "completed"
            drones_result = await session.execute(
                select(Drone).where(Drone.id.in_(run_drone_ids))
            )
            for d in drones_result.scalars().all():
                d.status = "idle"
            await session.commit()
        clear_current_run()
        if task_id is not None:
            async with async_session() as report_session:
                existing = await report_session.execute(
                    select(TaskReport).where(TaskReport.task_id == task_id)
                )
                if existing.scalar_one_or_none() is None:
                    report_session.add(TaskReport(task_id=task_id, status="pending"))
                    await report_session.commit()
                    asyncio.create_task(run_task_report_pipeline(task_id))
    get_simulator().stop()


async def on_assignment_arrival(session_id: int, task_id: int) -> None:
    """Per-assignment arrival: update DB (assignment arrived, session end, drone idle if no other flying), then check task completion."""
    async with async_session() as session:
        assignment_result = await session.execute(
            select(TaskAssignment).where(TaskAssignment.flight_session_id == session_id)
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment is None:
            return
        assignment.status = "arrived"
        session_result = await session.execute(
            select(FlightSession).where(FlightSession.id == session_id)
        )
        fs = session_result.scalar_one_or_none()
        if fs is not None:
            fs.end_time = datetime.utcnow()
        drone_id = assignment.drone_id
        drone_result = await session.execute(select(Drone).where(Drone.id == drone_id))
        d = drone_result.scalar_one_or_none()
        if d is not None:
            d.last_lat = assignment.dest_lat
            d.last_lng = assignment.dest_lng
        other_flying = await session.execute(
            select(TaskAssignment).where(
                TaskAssignment.drone_id == drone_id,
                TaskAssignment.status == "flying",
                TaskAssignment.id != assignment.id,
            )
        )
        if other_flying.scalar_one_or_none() is None and d is not None:
            d.status = "idle"
        task_result = await session.execute(select(Task).where(Task.id == task_id))
        task = task_result.scalar_one_or_none()
        task_completed_id: int | None = None
        if task is not None:
            remaining = await session.execute(
                select(TaskAssignment).where(
                    TaskAssignment.task_id == task_id,
                    TaskAssignment.status.in_(["flying", "paused", "starting", "pending"]),
                )
            )
            if remaining.scalar_one_or_none() is None:
                task.status = "completed"
                remove_task_run(task_id)
                task_completed_id = task_id
        await session.commit()
        if task_completed_id is not None:
            get_simulator().broadcast_event({"event": "arrived", "task_id": task_completed_id})
            async with async_session() as report_session:
                existing = await report_session.execute(
                    select(TaskReport).where(TaskReport.task_id == task_completed_id)
                )
                if existing.scalar_one_or_none() is None:
                    report_session.add(TaskReport(task_id=task_completed_id, status="pending"))
                    await report_session.commit()
                    asyncio.create_task(run_task_report_pipeline(task_completed_id))


async def on_assignment_low_battery(session_id: int, task_id: int) -> None:
    """電池耗盡：assignment 標為 failed、session 結束、drone idle，若 task 全結束則 task 標為 failed 並廣播。"""
    async with async_session() as session:
        assignment_result = await session.execute(
            select(TaskAssignment).where(TaskAssignment.flight_session_id == session_id)
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment is None:
            return
        assignment.status = "failed"
        session_result = await session.execute(
            select(FlightSession).where(FlightSession.id == session_id)
        )
        fs = session_result.scalar_one_or_none()
        if fs is not None:
            fs.end_time = datetime.utcnow()
        drone_id = assignment.drone_id
        drone_result = await session.execute(select(Drone).where(Drone.id == drone_id))
        d = drone_result.scalar_one_or_none()
        if d is not None:
            d.last_lat = assignment.start_lat
            d.last_lng = assignment.start_lng
        other_flying = await session.execute(
            select(TaskAssignment).where(
                TaskAssignment.drone_id == drone_id,
                TaskAssignment.status == "flying",
                TaskAssignment.id != assignment.id,
            )
        )
        if other_flying.scalar_one_or_none() is None and d is not None:
            d.status = "idle"
        task_result = await session.execute(select(Task).where(Task.id == task_id))
        task = task_result.scalar_one_or_none()
        task_failed_id: int | None = None
        if task is not None:
            remaining = await session.execute(
                select(TaskAssignment).where(
                    TaskAssignment.task_id == task_id,
                    TaskAssignment.status.in_(["flying", "paused", "starting", "pending"]),
                )
            )
            if remaining.scalar_one_or_none() is None:
                task.status = "failed"
                remove_task_run(task_id)
                task_failed_id = task_id
        await session.commit()
        if task_failed_id is not None:
            get_simulator().broadcast_event({"event": "failed_low_battery", "task_id": task_failed_id})


async def update_drone_last_positions_on_cancel(
    db: AsyncSession,
    assignments: list,
) -> dict[int, tuple[float, float]]:
    """For each assignment, get latest Telemetry lat/lng for its session (or use start_lat/start_lng). Return drone_id -> (lat, lng)."""
    position_by_drone: dict[int, tuple[float, float]] = {}
    for a in assignments:
        session_id = a.flight_session_id
        if session_id is None:
            position_by_drone[a.drone_id] = (a.start_lat, a.start_lng)
            continue
        result = await db.execute(
            select(Telemetry)
            .where(Telemetry.session_id == session_id)
            .order_by(desc(Telemetry.created_at))
            .limit(1)
        )
        t = result.scalar_one_or_none()
        if t is not None:
            position_by_drone[a.drone_id] = (t.lat, t.lng)
        else:
            position_by_drone[a.drone_id] = (a.start_lat, a.start_lng)
    return position_by_drone
