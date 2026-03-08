"""Task CRUD and lifecycle API."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Drone, FlightSession, Task, TaskAssignment, TaskReport
from app.schemas.task import (
    TaskCreateBody,
    TaskCreateAssignmentItem,
    TaskResponse,
    TaskAssignmentResponse,
    TaskReportResponse,
)
from app.services.run_state import add_task_run, get_run_for_task, remove_task_run
from app.services.simulator import get_simulator
from app.services.task_handlers import (
    on_assignment_arrival,
    on_assignment_low_battery,
    update_drone_last_positions_on_cancel,
)
from app.schemas.common import datetime_iso

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_to_response(task, assignments_with_names: list) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        name=task.name,
        status=task.status,
        created_at=datetime_iso(task.created_at),
        updated_at=datetime_iso(task.updated_at),
        assignments=[
            TaskAssignmentResponse(
                id=a.id,
                task_id=a.task_id,
                drone_id=a.drone_id,
                drone_name=drone_name,
                start_lat=a.start_lat,
                start_lng=a.start_lng,
                dest_lat=a.dest_lat,
                dest_lng=a.dest_lng,
                status=a.status,
                flight_session_id=a.flight_session_id,
            )
            for a, drone_name in assignments_with_names
        ],
    )


@router.post("", response_model=TaskResponse)
async def create_task(
    db: Annotated[AsyncSession, Depends(get_db)],
    body: TaskCreateBody,
):
    if not body.assignments:
        raise HTTPException(status_code=400, detail="At least one assignment required.")
    requested_drone_ids = list({item.drone_id for item in body.assignments})
    busy = await db.execute(
        select(TaskAssignment.drone_id)
        .join(Task, TaskAssignment.task_id == Task.id)
        .where(
            TaskAssignment.drone_id.in_(requested_drone_ids),
            Task.status.in_(["pending", "starting", "running", "paused"]),
        )
        .distinct()
    )
    busy_drone_ids = {row[0] for row in busy.all()}
    if busy_drone_ids:
        raise HTTPException(
            status_code=400,
            detail="部分無人機已被指派至其他任務，無法重複指派。",
        )
    task = Task(name=body.name or None, status="pending")
    db.add(task)
    await db.flush()
    created_assignments: list[TaskAssignment] = []
    for item in body.assignments:
        assignment = TaskAssignment(
            task_id=task.id,
            drone_id=item.drone_id,
            start_lat=item.start_lat,
            start_lng=item.start_lng,
            dest_lat=item.dest_lat,
            dest_lng=item.dest_lng,
            status="pending",
        )
        db.add(assignment)
        created_assignments.append(assignment)
    try:
        await db.commit()
    except IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="指定的無人機不存在或資料無效。",
        )
    assignments_with_names = []
    for a in created_assignments:
        drone_result = await db.execute(select(Drone).where(Drone.id == a.drone_id))
        drone = drone_result.scalar_one_or_none()
        assignments_with_names.append((a, drone.name if drone else None))
    return _task_to_response(task, assignments_with_names)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    q = (
        select(Task)
        .order_by(Task.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if status is not None:
        q = q.where(Task.status == status)
    result = await db.execute(q)
    tasks = result.scalars().unique().all()
    task_ids = [t.id for t in tasks]
    if not task_ids:
        return []
    assignments_result = await db.execute(
        select(TaskAssignment, Drone.name)
        .join(Drone, TaskAssignment.drone_id == Drone.id)
        .where(TaskAssignment.task_id.in_(task_ids))
    )
    assignments_with_names = list(assignments_result.all())
    by_task: dict[int, list] = {}
    for a, drone_name in assignments_with_names:
        by_task.setdefault(a.task_id, []).append((a, drone_name))
    return [
        _task_to_response(t, by_task.get(t.id, []))
        for t in tasks
    ]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    assignments_result = await db.execute(
        select(TaskAssignment, Drone.name)
        .join(Drone, TaskAssignment.drone_id == Drone.id)
        .where(TaskAssignment.task_id == task_id)
    )
    assignments_with_names = list(assignments_result.all())
    return _task_to_response(task, assignments_with_names)


@router.get("/{task_id}/report", response_model=TaskReportResponse)
async def get_task_report(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    report_result = await db.execute(
        select(TaskReport).where(TaskReport.task_id == task_id)
    )
    report = report_result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="No report for this task yet",
        )
    return TaskReportResponse(
        status=report.status,
        report_text=report.report_text,
        error_message=report.error_message,
        created_at=datetime_iso(report.created_at),
        updated_at=datetime_iso(report.updated_at),
    )


@router.post("/{task_id}/start")
async def task_start(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Task must be pending to start, current: {task.status}",
        )
    assignments_result = await db.execute(
        select(TaskAssignment).where(TaskAssignment.task_id == task_id)
    )
    assignments = list(assignments_result.scalars().all())
    if not assignments:
        raise HTTPException(status_code=400, detail="Task has no assignments")
    drone_ids = [a.drone_id for a in assignments]
    drones_result = await db.execute(select(Drone).where(Drone.id.in_(drone_ids)))
    drones = {d.id: d for d in drones_result.scalars().all()}
    for did in drone_ids:
        if did not in drones or drones[did].status != "idle":
            raise HTTPException(
                status_code=400,
                detail=f"Drone {did} not found or not idle",
            )
    task.status = "starting"
    await db.flush()
    drone_session_pairs: list[tuple[int, int]] = []
    for a in assignments:
        session = FlightSession(drone_id=a.drone_id)
        db.add(session)
        await db.flush()
        a.flight_session_id = session.id
        a.status = "flying"
        drones[a.drone_id].status = "flying"
        drone_session_pairs.append((a.drone_id, session.id))
    task.status = "running"
    await db.commit()
    add_task_run(task_id, drone_session_pairs)
    sim = get_simulator()
    instance_specs: list[tuple[int, int, float, float, float, float, object, object]] = []
    for a in assignments:
        sid = a.flight_session_id
        if sid is None:
            continue
        tid = task_id

        async def arrival_cb(session_id: int = sid, t_id: int = tid) -> None:
            await on_assignment_arrival(session_id, t_id)

        async def low_battery_cb(session_id: int = sid, t_id: int = tid) -> None:
            await on_assignment_low_battery(session_id, t_id)

        instance_specs.append(
            (
                a.drone_id,
                sid,
                a.start_lat,
                a.start_lng,
                a.dest_lat,
                a.dest_lng,
                arrival_cb,
                low_battery_cb,
            )
        )
    sim.add_instances(task_id, instance_specs)
    return {
        "status": "started",
        "task_id": task_id,
        "session_ids": [p[1] for p in drone_session_pairs],
    }


@router.post("/{task_id}/pause")
async def task_pause(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pairs = get_run_for_task(task_id)
    if pairs is None:
        raise HTTPException(
            status_code=400,
            detail="This task is not currently running",
        )
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is not None and task.status == "running":
        run_drone_ids = [p[0] for p in pairs]
        run_session_ids = [p[1] for p in pairs]
        assignments_result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.flight_session_id.in_(run_session_ids)
            )
        )
        assignments_list = list(assignments_result.scalars().all())
        position_by_drone = await update_drone_last_positions_on_cancel(
            db, assignments_list
        )
        drones_result = await db.execute(
            select(Drone).where(Drone.id.in_(run_drone_ids))
        )
        for d in drones_result.scalars().all():
            if d.id in position_by_drone:
                d.last_lat, d.last_lng = position_by_drone[d.id]
        task.status = "paused"
        assignments_result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.status == "flying",
            )
        )
        for a in assignments_result.scalars().all():
            a.status = "paused"
        await db.commit()
    get_simulator().pause_task(task_id)
    return {"status": "paused"}


@router.post("/{task_id}/resume")
async def task_resume(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if get_run_for_task(task_id) is None:
        raise HTTPException(
            status_code=400,
            detail="This task is not currently running",
        )
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is not None and task.status == "paused":
        task.status = "running"
        assignments_result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.status == "paused",
            )
        )
        for a in assignments_result.scalars().all():
            a.status = "flying"
        await db.commit()
    get_simulator().resume_task(task_id)
    return {"status": "resumed"}


@router.post("/{task_id}/cancel")
async def task_cancel(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "running", "paused", "starting"):
        raise HTTPException(
            status_code=400,
            detail=f"Task cannot be cancelled in status {task.status}",
        )
    pairs = get_run_for_task(task_id)
    if pairs:
        run_drone_ids = [p[0] for p in pairs]
        run_session_ids = [p[1] for p in pairs]
        from datetime import datetime

        now = datetime.utcnow()
        sessions = await db.execute(
            select(FlightSession).where(FlightSession.id.in_(run_session_ids))
        )
        for s in sessions.scalars().all():
            s.end_time = now
        assignments_result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.flight_session_id.in_(run_session_ids)
            )
        )
        assignments_list = list(assignments_result.scalars().all())
        for a in assignments_list:
            a.status = "cancelled"
        position_by_drone = await update_drone_last_positions_on_cancel(
            db, assignments_list
        )
        task.status = "cancelled"
        drones = await db.execute(select(Drone).where(Drone.id.in_(run_drone_ids)))
        for d in drones.scalars().all():
            if d.id in position_by_drone:
                d.last_lat, d.last_lng = position_by_drone[d.id]
            d.status = "idle"
        await db.commit()
        remove_task_run(task_id)
        get_simulator().remove_task_instances(task_id)
    else:
        if task.status == "pending":
            assignments_result = await db.execute(
                select(TaskAssignment).where(TaskAssignment.task_id == task_id)
            )
            for a in assignments_result.scalars().all():
                a.status = "cancelled"
            task.status = "cancelled"
            await db.commit()
    return {"status": "cancelled"}


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    pairs = get_run_for_task(task_id)
    if pairs:
        run_drone_ids = [p[0] for p in pairs]
        run_session_ids = [p[1] for p in pairs]
        from datetime import datetime

        now = datetime.utcnow()
        sessions = await db.execute(
            select(FlightSession).where(FlightSession.id.in_(run_session_ids))
        )
        for s in sessions.scalars().all():
            s.end_time = now
        assignments_result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.flight_session_id.in_(run_session_ids)
            )
        )
        assignments_list = list(assignments_result.scalars().all())
        for a in assignments_list:
            a.status = "cancelled"
        position_by_drone = await update_drone_last_positions_on_cancel(
            db, assignments_list
        )
        drones = await db.execute(select(Drone).where(Drone.id.in_(run_drone_ids)))
        for d in drones.scalars().all():
            if d.id in position_by_drone:
                d.last_lat, d.last_lng = position_by_drone[d.id]
            d.status = "idle"
        await db.flush()
        remove_task_run(task_id)
        get_simulator().remove_task_instances(task_id)
    await db.delete(task)
    await db.commit()
    return {"status": "deleted", "task_id": task_id}
