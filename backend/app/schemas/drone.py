"""Drone API request/response schemas."""
from pydantic import BaseModel


class DroneCreateBody(BaseModel):
    name: str
    base_speed_m_min: float = 500.0


class DroneUpdateBody(BaseModel):
    name: str | None = None
    base_speed_m_min: float | None = None


class DroneResponse(BaseModel):
    id: int
    name: str
    base_speed_m_min: float
    status: str
    last_lat: float | None
    last_lng: float | None
