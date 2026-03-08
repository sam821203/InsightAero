"""Simulation API request/response schemas."""
from pydantic import BaseModel


class SimulationStartBody(BaseModel):
    drone_count: int | None = None
    drone_ids: list[int] | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None


class SimulationStartResponse(BaseModel):
    status: str
    session_ids: list[int]
    drone_ids: list[int]


class SimulationStatusResponse(BaseModel):
    status: str
