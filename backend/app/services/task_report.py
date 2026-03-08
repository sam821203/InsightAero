"""Task-level report pipeline: fetch trajectory for task, aggregate stats, call LLM, store TaskReport."""
import json
from typing import Any

from sqlalchemy import select

from app.database import async_session
from app.models import TaskAssignment, TaskReport, Telemetry, FlightSession
from app.services.ai_report import generate_flight_summary


async def run_task_report_pipeline(task_id: int) -> None:
    """
    Load all session telemetry for the task, aggregate stats, generate summary via LLM,
    then update the existing TaskReport row (created with status=pending by caller).
    On exception, set status=failed and error_message.
    """
    async with async_session() as session:
        report_result = await session.execute(
            select(TaskReport).where(TaskReport.task_id == task_id)
        )
        task_report = report_result.scalar_one_or_none()
        if task_report is None:
            return

        try:
            # 1. Get all assignments with session_id for this task
            assignments_result = await session.execute(
                select(TaskAssignment)
                .where(
                    TaskAssignment.task_id == task_id,
                    TaskAssignment.flight_session_id.isnot(None),
                )
            )
            assignments = list(assignments_result.scalars().all())
            session_ids = [a.flight_session_id for a in assignments if a.flight_session_id is not None]
            if not session_ids:
                task_report.status = "completed"
                task_report.report_text = "本任務無飛行軌跡紀錄，無法產出報告。"
                task_report.error_message = None
                await session.commit()
                return

            # 2. Load full telemetry per session (ordered by created_at)
            all_telemetry: list[dict[str, Any]] = []
            weather_snapshot: dict[str, Any] = {}

            for sid in session_ids:
                telemetry_result = await session.execute(
                    select(Telemetry)
                    .where(Telemetry.session_id == sid)
                    .order_by(Telemetry.created_at.asc())
                )
                rows = telemetry_result.scalars().all()
                session_list = [
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
                    for t in rows
                ]
                all_telemetry.extend(session_list)

                # Use first session's weather for summary if not set
                if not weather_snapshot and rows:
                    fs_result = await session.execute(
                        select(FlightSession).where(FlightSession.id == sid)
                    )
                    fs = fs_result.scalar_one_or_none()
                    if fs and fs.weather_snapshot:
                        try:
                            weather_snapshot = json.loads(fs.weather_snapshot)
                        except Exception:
                            pass
                if not weather_snapshot and session_list:
                    last = session_list[-1]
                    weather_snapshot = {
                        "wind_speed": last.get("wind_speed", 0),
                        "wind_deg": last.get("wind_deg", 0),
                    }

            if not all_telemetry:
                task_report.status = "completed"
                task_report.report_text = "本任務無有效遙測資料，無法產出報告。"
                task_report.error_message = None
                await session.commit()
                return

            # 3. Build summary for LLM (avoid token overflow: sample or aggregate)
            # Use last 5 per session or overall last 20 points + aggregate stats
            n_total = len(all_telemetry)
            if n_total <= 30:
                telemetry_snapshot = all_telemetry
            else:
                # Sample: first 5, then every Nth to get ~15, then last 5
                step = max(1, (n_total - 10) // 10)
                indices = [0] + list(range(step, n_total - 5, step))[-10:] + [n_total - 1]
                indices = sorted(set(indices))[:25]
                telemetry_snapshot = [all_telemetry[i] for i in indices]

            avg_speed = sum(t.get("effective_speed_m_min", 0) for t in all_telemetry) / n_total
            battery_start = all_telemetry[0].get("battery", 100)
            battery_end = all_telemetry[-1].get("battery", 0)
            summary_note = (
                f"（任務共 {n_total} 筆遙測，平均有效分速 {avg_speed:.0f} m/min，"
                f"電池 {battery_start:.0f}% → {battery_end:.0f}%）"
            )

            # 4. Generate report via existing AI summary
            report_text = await generate_flight_summary(telemetry_snapshot, weather_snapshot)
            if summary_note and report_text:
                report_text = report_text.rstrip() + " " + summary_note

            task_report.status = "completed"
            task_report.report_text = report_text
            task_report.error_message = None
            await session.commit()
        except Exception as e:
            task_report.status = "failed"
            task_report.error_message = str(e)
            await session.commit()
