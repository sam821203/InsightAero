"""Diagnosis service: LangChain ReAct agent with optional in-memory history (last 5 min)."""
import time
from pathlib import Path
from typing import Any

from app.config import OPENAI_API_KEY
from app.services.env_tools import ENV_TOOLS

# In-memory history: session_id -> list of (timestamp_sec, user_summary, output)
# Truncate to entries within last 5 minutes when building context
_MEMORY_MINUTES = 5
_diagnosis_history: dict[str, list[tuple[float, str, str]]] = {}
_max_entries_per_session = 20


def _load_prompt_template() -> str:
    path = Path(__file__).resolve().parent.parent / "prompts" / "diagnosis.txt"
    return path.read_text(encoding="utf-8").strip()


def _build_telemetry_summary(telemetry_snapshot: list[dict[str, Any]]) -> str:
    """將遙測快照整理成給 Agent 的摘要（最近幾筆＋趨勢）。"""
    if not telemetry_snapshot:
        return "目前無遙測資料。"
    recent = (
        telemetry_snapshot[-5:]
        if len(telemetry_snapshot) >= 5
        else telemetry_snapshot
    )
    lines = []
    for i, t in enumerate(recent):
        lines.append(
            f"  第{i+1}筆: 位置({t.get('lat', 0):.4f}, {t.get('lng', 0):.4f}), "
            f"高度 {t.get('alt', 0):.0f}m, 時速 {t.get('speed', 0):.1f} m/min, "
            f"航向 {t.get('heading', 0):.0f}°, 電池 {t.get('battery', 0):.0f}%, "
            f"有效分速 {t.get('effective_speed_m_min', 0):.0f} m/min, "
            f"風速 {t.get('wind_speed', 0):.1f} m/s 風向 {t.get('wind_deg', 0):.0f}°"
        )
    return "\n".join(lines)


def _fallback_diagnosis(
    telemetry_snapshot: list[dict[str, Any]],
    weather_snapshot: dict[str, Any],
) -> str:
    """無 OpenAI 或 Agent 失敗時的純規則 fallback。"""
    if not telemetry_snapshot:
        return "無遙測資料，無法產出環境診斷。"
    last = telemetry_snapshot[-1]
    w = weather_snapshot or {}
    wind_speed = last.get("wind_speed") or w.get("wind_speed", 0)
    wind_deg = last.get("wind_deg") or w.get("wind_deg", 0)
    speed = last.get("effective_speed_m_min", last.get("speed", 0))
    return (
        f"目前有效分速 {speed:.0f} m/min，風速 {wind_speed} m/s、風向 {wind_deg}°。"
        "（啟用 OPENAI_API_KEY 可取得結合地形與氣象的語意化診斷）"
    )


def _get_recent_context(session_id: str) -> str:
    """Return a short context string from recent diagnosis within last 5 minutes."""
    if session_id not in _diagnosis_history:
        return ""
    now = time.time()
    cutoff = now - _MEMORY_MINUTES * 60
    entries = [
        (ts, summary, out)
        for ts, summary, out in _diagnosis_history[session_id]
        if ts >= cutoff
    ]
    if not entries:
        return ""
    # Use the most recent entry
    ts, summary, out = entries[-1]
    mins_ago = int((now - ts) / 60)
    return (
        f"\n\n（前次診斷約 {mins_ago} 分鐘前）：\n"
        f"前次遙測摘要：{summary[:200]}...\n"
        f"前次診斷結果：{out[:300]}{'...' if len(out) > 300 else ''}"
    )


def _save_to_memory(session_id: str, user_summary: str, output: str) -> None:
    if session_id not in _diagnosis_history:
        _diagnosis_history[session_id] = []
    _diagnosis_history[session_id].append((time.time(), user_summary, output))
    # Keep only last N entries
    if len(_diagnosis_history[session_id]) > _max_entries_per_session:
        _diagnosis_history[session_id] = _diagnosis_history[session_id][
            -_max_entries_per_session:
        ]


class DiagnosisService:
    """Environment diagnosis using ReAct agent with optional recent-history context."""

    def __init__(self) -> None:
        self._prompt_template = _load_prompt_template()

    async def diagnose(
        self,
        telemetry_snapshot: list[dict[str, Any]],
        weather_snapshot: dict[str, Any] | None = None,
        session_id: str | None = None,
        use_memory: bool = True,
    ) -> str:
        """
        Run diagnosis. If session_id and use_memory, include last 5 min trend context.
        """
        if not OPENAI_API_KEY:
            return _fallback_diagnosis(
                telemetry_snapshot, weather_snapshot or {}
            )

        try:
            from langchain.agents import AgentExecutor, create_react_agent
            from langchain_core.prompts import PromptTemplate
            from langchain_openai import ChatOpenAI

            prompt = PromptTemplate.from_template(self._prompt_template)
            telemetry_summary = _build_telemetry_summary(telemetry_snapshot)
            weather_summary = str(weather_snapshot) if weather_snapshot else "無"
            last = telemetry_snapshot[-1] if telemetry_snapshot else {}
            lat = last.get("lat", 0)
            lng = last.get("lng", 0)

            memory_context = ""
            if use_memory and session_id:
                memory_context = _get_recent_context(session_id)

            user_input = (
                f"最近遙測摘要：\n{telemetry_summary}\n\n"
                f"氣象快照（若已有）：{weather_summary}\n\n"
                f"請用工具查詢「當前位置」的經緯度 ({lat}, {lng}) 的地形與氣象，"
                "然後產出 1～2 句中文診斷與建議（例如：當前逆風幾級、是否處於翻山爬升階段、是否建議調整航速以節省電池、任務可行性建議）。"
                + memory_context
            )

            llm = ChatOpenAI(
                model="gpt-4o-mini",
                api_key=OPENAI_API_KEY,
                temperature=0.3,
            )
            agent = create_react_agent(llm, ENV_TOOLS, prompt)
            executor = AgentExecutor(
                agent=agent,
                tools=ENV_TOOLS,
                handle_parsing_errors=True,
                max_iterations=5,
                return_intermediate_steps=False,
            )
            result = await executor.ainvoke({"input": user_input})
            out = result.get("output", "")
            if isinstance(out, str) and out.strip():
                output = out.strip()
                if session_id:
                    _save_to_memory(session_id, telemetry_summary, output)
                return output
            return _fallback_diagnosis(
                telemetry_snapshot, weather_snapshot or {}
            )
        except Exception as e:
            return _fallback_diagnosis(
                telemetry_snapshot, weather_snapshot or {}
            ) + f" （診斷過程發生錯誤：{e}）"


# Singleton for use by env_diagnosis and API
_diagnosis_service: DiagnosisService | None = None


def get_diagnosis_service() -> DiagnosisService:
    global _diagnosis_service
    if _diagnosis_service is None:
        _diagnosis_service = DiagnosisService()
    return _diagnosis_service
