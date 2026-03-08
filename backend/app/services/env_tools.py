"""環境診斷 Agent 用 Structured Tools：地形海拔、氣象、任務電池試算。"""
import json
import re
from pydantic import BaseModel, Field

from langchain_core.tools import StructuredTool

from app.services.battery_planning import simulate_path_battery
from app.services.elevation import get_elevation
from app.services.weather import get_weather


def _parse_lat_lng(value: str) -> tuple[float, float]:
    """從 LLM 傳入的字串解析出 (lat, lng)。支援 JSON 或 "lat,lng" 格式。"""
    if not isinstance(value, str):
        value = str(value)
    s = value.strip()
    if not s:
        raise ValueError("location is empty")
    # 嘗試 JSON：{"lat": 24.2, "lng": 120.8}，可能帶尾端空白/換行
    if "{" in s and "}" in s:
        start = s.index("{")
        end = s.rindex("}") + 1
        try:
            data = json.loads(s[start:end])
            lat = float(data.get("lat", data.get("latitude")))
            lng = float(data.get("lng", data.get("lon", data.get("longitude"))))
            return (lat, lng)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            raise ValueError(f"Invalid JSON for lat/lng: {e}") from e
    # 嘗試 "lat,lng" 或 "lat lng"
    parts = re.split(r"[\s,]+", s, maxsplit=1)
    if len(parts) >= 2:
        try:
            return (float(parts[0].strip()), float(parts[1].strip()))
        except ValueError:
            pass
    raise ValueError(f"Cannot parse lat/lng from: {s[:80]!r}")


def _m_s_to_beaufort(wind_speed_m_s: float) -> int:
    """風速 m/s 對照蒲福風級（約略）。0–0.2→0, 0.3–1.5→1, 1.6–3.3→2, 3.4–5.4→3, 5.5–7.9→4, 8.0–10.7→5, ..."""
    if wind_speed_m_s <= 0.2:
        return 0
    if wind_speed_m_s <= 1.5:
        return 1
    if wind_speed_m_s <= 3.3:
        return 2
    if wind_speed_m_s <= 5.4:
        return 3
    if wind_speed_m_s <= 7.9:
        return 4
    if wind_speed_m_s <= 10.7:
        return 5
    if wind_speed_m_s <= 13.8:
        return 6
    if wind_speed_m_s <= 17.1:
        return 7
    return min(12, 5 + int((wind_speed_m_s - 10.7) / 3))


class GetTerrainElevationInput(BaseModel):
    """取得指定經緯度的地表海拔。傳入經緯度，例如 JSON 字串 {\"lat\": 24.2, \"lng\": 120.8} 或 \"24.2, 120.8\"。"""

    location: str = Field(
        description='經緯度，格式為 JSON 字串如 {"lat": 24.2, "lng": 120.8} 或逗號分隔 "lat,lng"'
    )


class GetWeatherAtLocationInput(BaseModel):
    """取得指定經緯度的即時氣象。傳入經緯度，例如 JSON 字串 {\"lat\": 24.2, \"lng\": 120.8} 或 \"24.2, 120.8\"。"""

    location: str = Field(
        description='經緯度，格式為 JSON 字串如 {"lat": 24.2, "lng": 120.8} 或逗號分隔 "lat,lng"'
    )


async def _get_terrain_elevation(location: str) -> str:
    """Tool 實作：回傳給 Agent 的字串描述。"""
    lat, lng = _parse_lat_lng(location)
    data = await get_elevation(lat, lng)
    elev = data["elevation_m"]
    res = data["resolution_m"]
    if elev > 500:
        terrain_note = "地形為山地或丘陵，可能處於爬升／翻山階段。"
    elif elev > 100:
        terrain_note = "地形有起伏，可能略有爬升。"
    else:
        terrain_note = "地形較平坦。"
    return f"經緯度 ({lat}, {lng}) 地表海拔：{elev:.0f} 公尺，解析度約 {res:.0f} 公尺。{terrain_note}"


async def _get_weather_at_location(location: str) -> str:
    """Tool 實作：回傳給 Agent 的字串（含風速 m/s、風向、蒲福級數提示）。"""
    lat, lng = _parse_lat_lng(location)
    w = await get_weather(lat, lng)
    wind_speed = w["wind_speed"]
    wind_deg = w["wind_deg"]
    temp = w.get("temp")
    level = _m_s_to_beaufort(wind_speed)
    temp_str = f"，氣溫 {temp}°C" if temp is not None else ""
    return (
        f"經緯度 ({lat}, {lng}) 即時氣象：風速 {wind_speed:.1f} m/s（約蒲福 {level} 級），"
        f"風向 {wind_deg:.0f}°（0=北、90=東、180=南、270=西）{temp_str}。"
    )


get_terrain_elevation = StructuredTool.from_function(
    coroutine=_get_terrain_elevation,
    name="get_terrain_elevation",
    description="取得指定經緯度的地表海拔（公尺）與地形描述，用於判斷是否處於爬升或翻山階段。",
    args_schema=GetTerrainElevationInput,
)

get_weather_at_location = StructuredTool.from_function(
    coroutine=_get_weather_at_location,
    name="get_weather_at_location",
    description="取得指定經緯度的即時氣象（風速 m/s、風向度數、蒲福風級、氣溫），用於判斷逆風／順風與風力強度。",
    args_schema=GetWeatherAtLocationInput,
)


class PlanMissionBatteryInput(BaseModel):
    """任務電池試算：傳入起點與終點經緯度、可選初始電量，回傳試算結果與語意化分析。"""

    start_location: str = Field(
        description='起點經緯度，格式為 JSON 如 {"lat": 24.2, "lng": 120.8} 或 "24.2, 120.8"'
    )
    end_location: str = Field(
        description='終點經緯度，格式為 JSON 如 {"lat": 25.0, "lng": 121.0} 或 "25.0, 121.0"'
    )
    initial_battery_pct: float = Field(
        default=100.0,
        description="初始電量百分比，預設 100",
    )


async def _plan_mission_battery(
    start_location: str,
    end_location: str,
    initial_battery_pct: float = 100.0,
) -> str:
    """Tool 實作：依起終點試算電池消耗，回傳 status、剩餘電量、analysis 等摘要給 Agent。"""
    start_lat, start_lng = _parse_lat_lng(start_location)
    end_lat, end_lng = _parse_lat_lng(end_location)
    path = [(start_lat, start_lng), (end_lat, end_lng)]
    result = await simulate_path_battery(
        path, initial_battery_pct, get_weather, get_elevation
    )
    status = result["status"]
    remaining = result.get("remaining_battery_pct")
    analysis = result.get("analysis", "")
    n_points = len(result.get("path", []))
    summary = f"status: {status}, 剩餘電量: {remaining}%, 路徑點數: {n_points}. {analysis}"
    return summary


plan_mission_battery = StructuredTool.from_function(
    coroutine=_plan_mission_battery,
    name="plan_mission_battery",
    description="依起點與終點經緯度試算任務電池消耗（含風向、海拔），回傳是否可達、剩餘電量與語意化分析，供決策是否執行任務。",
    args_schema=PlanMissionBatteryInput,
)

ENV_TOOLS = [get_terrain_elevation, get_weather_at_location, plan_mission_battery]
