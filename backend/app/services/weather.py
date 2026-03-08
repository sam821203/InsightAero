"""OpenWeather API 取得風速、風向，供模擬器做有效分速修正。"""
import json
import os
from typing import Any

import httpx

from app.config import OPENWEATHER_API_KEY, OPENWEATHER_BASE


async def get_weather(lat: float, lng: float) -> dict[str, Any]:
    """取得指定經緯度的即時氣象（含 wind speed, wind deg）。"""
    if not OPENWEATHER_API_KEY:
        return {"wind_speed": 0.0, "wind_deg": 0.0, "temp": None}

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{OPENWEATHER_BASE}/weather",
            params={"lat": lat, "lon": lng, "appid": OPENWEATHER_API_KEY, "units": "metric"},
            timeout=10.0,
        )
        r.raise_for_status()
        data = r.json()
    wind = data.get("wind", {})
    # OpenWeather: speed 單位 m/s, deg 0-360
    return {
        "wind_speed": float(wind.get("speed", 0)),
        "wind_deg": float(wind.get("deg", 0)),
        "temp": data.get("main", {}).get("temp"),
    }


def effective_speed_m_min(
    base_speed_m_min: float,
    heading_deg: float,
    wind_speed_m_s: float,
    wind_deg: float,
) -> float:
    """
    根據航向與風向的向量合成，計算有效分速 (m/min)。
    逆風減速、順風加速。
    """
    import math
    heading_rad = math.radians(heading_deg)
    wind_rad = math.radians(wind_deg)
    # 風對航向的投影：逆風為正、順風為負
    wind_along = wind_speed_m_s * math.cos(heading_rad - wind_rad)
    # 風速換算為 m/min，與 base 加總（逆風時 wind_along > 0 會減速）
    wind_effect_m_min = wind_along * 60
    return max(50.0, base_speed_m_min - wind_effect_m_min)
