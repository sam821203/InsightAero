"""Plan-mission and diagnose API (AI)."""
from typing import Annotated

from fastapi import APIRouter, HTTPException

from app.services.battery_planning import simulate_path_battery
from app.services.elevation import get_elevation
from app.services.env_diagnosis import run_environment_diagnosis
from app.services.weather import get_weather
from app.schemas.diagnose import PlanMissionBody, DiagnoseBody

router = APIRouter(prefix="/api", tags=["diagnose"])


@router.post("/plan-mission")
async def plan_mission(body: PlanMissionBody):
    """依起終點與可選 waypoints 試算電池消耗，回傳可達 path、status、剩餘電量、語意化 analysis。"""
    path: list[tuple[float, float]] = [(body.start_lat, body.start_lng)]
    if body.waypoints:
        for wp in body.waypoints:
            path.append((wp.lat, wp.lng))
    path.append((body.end_lat, body.end_lng))
    result = await simulate_path_battery(
        path,
        body.initial_battery_pct,
        get_weather,
        get_elevation,
    )
    return {
        "path": result["path"],
        "status": result["status"],
        "remaining_battery_pct": result["remaining_battery_pct"],
        "analysis": result["analysis"],
    }


@router.post("/diagnose")
async def create_diagnosis_from_payload(body: DiagnoseBody):
    """依傳入的遙測（與可選氣象快照）產出環境診斷，不查 DB。供即時 packet 或前端手動觸發。"""
    if not body.telemetry:
        raise HTTPException(status_code=400, detail="telemetry must not be empty")
    diagnosis = await run_environment_diagnosis(
        body.telemetry,
        body.weather_snapshot,
    )
    return {"diagnosis": diagnosis}
