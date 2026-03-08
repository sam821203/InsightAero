from datetime import datetime
from sqlalchemy import Float, Integer, String, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Task status: pending | starting | running | paused | completed | cancelled | failed
# Assignment status: pending | starting | flying | paused | arrived | cancelled | failed
# Mission log: state transitions for Task or TaskAssignment (Pending -> Ongoing -> Completed/Failed)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments: Mapped[list["TaskAssignment"]] = relationship(
        "TaskAssignment", back_populates="task", cascade="all, delete-orphan"
    )
    report: Mapped["TaskReport | None"] = relationship(
        "TaskReport", back_populates="task", uselist=False, cascade="all, delete-orphan"
    )


class TaskReport(Base):
    __tablename__ = "task_reports"
    __table_args__ = (UniqueConstraint("task_id", name="uq_task_reports_task_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending | completed | failed
    report_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task: Mapped["Task"] = relationship("Task", back_populates="report")


class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    drone_id: Mapped[int] = mapped_column(ForeignKey("drones.id"), nullable=False)
    start_lat: Mapped[float] = mapped_column(Float, nullable=False)
    start_lng: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lat: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lng: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    flight_session_id: Mapped[int | None] = mapped_column(ForeignKey("flight_sessions.id"), nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="assignments")
    drone: Mapped["Drone"] = relationship("Drone", back_populates="task_assignments")
    flight_session: Mapped["FlightSession | None"] = relationship(
        "FlightSession", foreign_keys=[flight_session_id]
    )


class Drone(Base):
    __tablename__ = "drones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    base_speed_m_min: Mapped[float] = mapped_column(Float, default=500.0)
    status: Mapped[str] = mapped_column(String(32), default="idle")
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    flight_sessions: Mapped[list["FlightSession"]] = relationship("FlightSession", back_populates="drone")
    task_assignments: Mapped[list["TaskAssignment"]] = relationship(
        "TaskAssignment", back_populates="drone"
    )


class FlightSession(Base):
    __tablename__ = "flight_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    drone_id: Mapped[int] = mapped_column(ForeignKey("drones.id"), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    weather_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: wind_speed, wind_deg

    drone: Mapped["Drone | None"] = relationship("Drone", back_populates="flight_sessions")
    telemetry_records: Mapped[list["Telemetry"]] = relationship("Telemetry", back_populates="session")


class MissionLog(Base):
    """Mission state transition log: one row per status change (Task or Assignment)."""
    __tablename__ = "mission_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(32), nullable=True)  # null for initial
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: assignment_id, etc.


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("flight_sessions.id"), nullable=True)

    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    alt: Mapped[float] = mapped_column(Float, default=0.0)
    speed: Mapped[float] = mapped_column(Float, default=0.0)
    heading: Mapped[float] = mapped_column(Float, default=0.0)
    battery: Mapped[float] = mapped_column(Float, default=100.0)
    wind_speed: Mapped[float] = mapped_column(Float, default=0.0)
    wind_deg: Mapped[float] = mapped_column(Float, default=0.0)
    effective_speed_m_min: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["FlightSession | None"] = relationship("FlightSession", back_populates="telemetry_records")
