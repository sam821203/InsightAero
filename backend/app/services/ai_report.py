"""LangChain + OpenAI：飛行結束後產生任務總結（平均分速、風力抗性、電池效率）。"""
from typing import Any

from app.config import OPENAI_API_KEY


async def generate_flight_summary(
    telemetry_snapshot: list[dict[str, Any]],
    weather_snapshot: dict[str, Any],
) -> str:
    """
    根據一段遙測與氣象快照，產出語意化任務總結。
    若未設定 OPENAI_API_KEY 則回傳純文字摘要。
    """
    if not OPENAI_API_KEY or not telemetry_snapshot:
        # 無 API key 時回傳簡單摘要
        last = telemetry_snapshot[-1] if telemetry_snapshot else {}
        w = weather_snapshot
        return (
            f"任務摘要：平均有效分速 {last.get('effective_speed_m_min', 0):.0f} m/min，"
            f"風速 {w.get('wind_speed', 0)} m/s、風向 {w.get('wind_deg', 0)}°。"
            "（設定 OPENAI_API_KEY 可啟用 AI 結案報告）"
        )

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.3)
        # 簡化：只丟最後幾筆遙測 + 氣象，讓 LLM 產出總結
        summary_input = {
            "last_telemetry": telemetry_snapshot[-5:] if len(telemetry_snapshot) >= 5 else telemetry_snapshot,
            "weather": weather_snapshot,
        }
        msg = HumanMessage(
            content=f"根據以下飛行遙測與氣象資料，用 2–3 句話產出任務總結（含平均分速、風力影響、電池效率）：\n{summary_input}"
        )
        resp = await llm.ainvoke([msg])
        return resp.content if hasattr(resp, "content") else str(resp)
    except Exception as e:
        return f"AI 報告產生失敗：{e}"
