"""環境診斷：對外介面，委派給 DiagnosisService。"""
from typing import Any

from app.services.diagnosis_service import get_diagnosis_service


async def run_environment_diagnosis(
    telemetry_snapshot: list[dict[str, Any]],
    weather_snapshot: dict[str, Any] | None = None,
    session_id: str | None = None,
    use_memory: bool = True,
) -> str:
    """
    根據遙測與可選氣象快照，由 Agent 呼叫地形／氣象 Tools 後產出 1～2 句中文診斷與建議。
    若提供 session_id 且 use_memory=True，會參考該 session 前 5 分鐘內的診斷紀錄做趨勢判斷。
    """
    service = get_diagnosis_service()
    return await service.diagnose(
        telemetry_snapshot,
        weather_snapshot=weather_snapshot,
        session_id=session_id,
        use_memory=use_memory,
    )
