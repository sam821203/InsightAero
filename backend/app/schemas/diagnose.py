"""Diagnose / plan-mission API request schemas."""
from pydantic import BaseModel


class PlanMissionWaypoint(BaseModel):
    lat: float
    lng: float


class PlanMissionBody(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    waypoints: list[PlanMissionWaypoint] | None = None
    initial_battery_pct: float = 100.0


class DiagnoseBody(BaseModel):
    telemetry: list[dict]
    weather_snapshot: dict | None = None
