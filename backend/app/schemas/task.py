"""Task API request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class TaskCreateAssignmentItem(BaseModel):
    drone_id: int
    start_lat: float
    start_lng: float
    dest_lat: float
    dest_lng: float


class TaskCreateBody(BaseModel):
    name: str | None = None
    assignments: list[TaskCreateAssignmentItem]


class TaskAssignmentResponse(BaseModel):
    id: int
    task_id: int
    drone_id: int
    drone_name: str | None = None
    start_lat: float
    start_lng: float
    dest_lat: float
    dest_lng: float
    status: str
    flight_session_id: int | None


class TaskResponse(BaseModel):
    id: int
    name: str | None
    status: str
    created_at: str | None
    updated_at: str | None = None
    assignments: list[TaskAssignmentResponse]


class TaskReportResponse(BaseModel):
    status: str
    report_text: str | None
    error_message: str | None
    created_at: str | None
    updated_at: str | None = None
