"""Flight sessions and session report/diagnose API."""
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Drone, FlightSession, Telemetry
from app.services.ai_report import generate_flight_summary
from app.services.env_diagnosis import run_environment_diagnosis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/flight-sessions", tags=["flight-sessions"])


@router.get("")
async def list_flight_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
    drone_id: int | None = None,
):
    q = (
        select(FlightSession, Drone.name)
        .outerjoin(Drone, FlightSession.drone_id == Drone.id)
        .order_by(FlightSession.start_time.desc())
        .offset(offset)
        .limit(limit)
    )
    if drone_id is not None:
        q = q.where(FlightSession.drone_id == drone_id)
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "id": s.id,
            "drone_id": s.drone_id,
            "drone_name": name or None,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "weather_snapshot": s.weather_snapshot,
        }
        for s, name in rows
    ]


@router.get("/{session_id}/telemetry")
async def get_session_telemetry(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 1000,
    offset: int = 0,
):
    result = await db.execute(
        select(Telemetry)
        .where(Telemetry.session_id == session_id)
        .order_by(Telemetry.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": t.id,
            "session_id": t.session_id,
            "lat": t.lat,
            "lng": t.lng,
            "alt": t.alt,
            "speed": t.speed,
            "heading": t.heading,
            "battery": t.battery,
            "wind_speed": t.wind_speed,
            "wind_deg": t.wind_deg,
            "effective_speed_m_min": t.effective_speed_m_min,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in rows
    ]


@router.post("/{session_id}/report")
async def create_session_report(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(FlightSession).where(FlightSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    telemetry_result = await db.execute(
        select(Telemetry)
        .where(Telemetry.session_id == session_id)
        .order_by(Telemetry.created_at.asc())
    )
    telemetry_rows = telemetry_result.scalars().all()
    telemetry_snapshot = [
        {
            "lat": t.lat,
            "lng": t.lng,
            "alt": t.alt,
            "speed": t.speed,
            "heading": t.heading,
            "battery": t.battery,
            "wind_speed": t.wind_speed,
            "wind_deg": t.wind_deg,
            "effective_speed_m_min": t.effective_speed_m_min,
        }
        for t in telemetry_rows
    ]
    weather_snapshot = {}
    if session.weather_snapshot:
        try:
            weather_snapshot = json.loads(session.weather_snapshot)
        except json.JSONDecodeError as e:
            logger.warning("Invalid weather_snapshot JSON for session %s: %s", session_id, e)
    report = await generate_flight_summary(telemetry_snapshot, weather_snapshot)
    return {"report": report}


@router.post("/{session_id}/diagnose")
async def create_session_diagnosis(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """依該 session 最近遙測與氣象快照，產出環境診斷（地形＋氣象＋語意化建議）。"""
    result = await db.execute(
        select(FlightSession).where(FlightSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    telemetry_result = await db.execute(
        select(Telemetry)
        .where(Telemetry.session_id == session_id)
        .order_by(Telemetry.created_at.desc())
        .limit(50)
    )
    telemetry_rows = list(telemetry_result.scalars().all())[::-1]
    telemetry_snapshot = [
        {
            "lat": t.lat,
            "lng": t.lng,
            "alt": t.alt,
            "speed": t.speed,
            "heading": t.heading,
            "battery": t.battery,
            "wind_speed": t.wind_speed,
            "wind_deg": t.wind_deg,
            "effective_speed_m_min": t.effective_speed_m_min,
        }
        for t in telemetry_rows
    ]
    weather_snapshot = {}
    if session.weather_snapshot:
        try:
            weather_snapshot = json.loads(session.weather_snapshot)
        except json.JSONDecodeError as e:
            logger.warning("Invalid weather_snapshot JSON for session %s: %s", session_id, e)
    diagnosis = await run_environment_diagnosis(
        telemetry_snapshot,
        weather_snapshot,
        session_id=f"session_{session_id}",
        use_memory=True,
    )
    return {"diagnosis": diagnosis}
