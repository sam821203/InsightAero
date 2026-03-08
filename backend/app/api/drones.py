"""Drone CRUD API."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Drone, TaskAssignment, FlightSession
from app.schemas.drone import DroneCreateBody, DroneUpdateBody, DroneResponse

router = APIRouter(prefix="/api/drones", tags=["drones"])


@router.post("", response_model=DroneResponse)
async def create_drone(
    body: DroneCreateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    name = (body.name or "").strip()
    if not name or len(name) > 128:
        raise HTTPException(status_code=400, detail="name required, max 128 chars")
    drone = Drone(
        name=name,
        base_speed_m_min=body.base_speed_m_min,
        status="idle",
    )
    db.add(drone)
    await db.flush()
    return DroneResponse(
        id=drone.id,
        name=drone.name,
        base_speed_m_min=drone.base_speed_m_min,
        status=drone.status,
        last_lat=drone.last_lat,
        last_lng=drone.last_lng,
    )


@router.get("", response_model=list[DroneResponse])
async def list_drones(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Drone))
    drones = result.scalars().all()
    return [
        DroneResponse(
            id=d.id,
            name=d.name,
            base_speed_m_min=d.base_speed_m_min,
            status=d.status,
            last_lat=d.last_lat,
            last_lng=d.last_lng,
        )
        for d in drones
    ]


@router.patch("/{drone_id}", response_model=DroneResponse)
async def update_drone(
    drone_id: int,
    body: DroneUpdateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    if drone is None:
        raise HTTPException(status_code=404, detail="Drone not found")
    if body.name is not None:
        name = (body.name or "").strip()
        if not name or len(name) > 128:
            raise HTTPException(status_code=400, detail="name required, max 128 chars")
        drone.name = name
    if body.base_speed_m_min is not None:
        if body.base_speed_m_min <= 0:
            raise HTTPException(status_code=400, detail="base_speed_m_min must be positive")
        drone.base_speed_m_min = body.base_speed_m_min
    await db.flush()
    return DroneResponse(
        id=drone.id,
        name=drone.name,
        base_speed_m_min=drone.base_speed_m_min,
        status=drone.status,
        last_lat=drone.last_lat,
        last_lng=drone.last_lng,
    )


@router.delete("/{drone_id}", status_code=204)
async def delete_drone(
    drone_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Drone).where(Drone.id == drone_id))
    drone = result.scalar_one_or_none()
    if drone is None:
        raise HTTPException(status_code=404, detail="Drone not found")
    assignments_result = await db.execute(
        select(TaskAssignment).where(TaskAssignment.drone_id == drone_id).limit(1)
    )
    if assignments_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="無法刪除：此無人機已有任務或飛行紀錄",
        )
    sessions_result = await db.execute(
        select(FlightSession).where(FlightSession.drone_id == drone_id).limit(1)
    )
    if sessions_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="無法刪除：此無人機已有任務或飛行紀錄",
        )
    await db.delete(drone)
    return Response(status_code=204)
