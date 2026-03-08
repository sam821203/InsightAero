"""
風力感應電池消耗與路徑試算：基礎耗電、海拔修正、順/逆風加權，路徑截斷與語意化 analysis。
供規劃 API 與 LangChain Tool 使用；不直接改動即時模擬器。
"""
from __future__ import annotations

import math
from collections.abc import Awaitable, Callable
from typing import Any

# 與 wind_compensation / simulator 一致
METERS_PER_DEGREE_LAT = 111320

# 耗電常數
BASE_DRAIN_PER_KM = 5.0  # 基準：每公里消耗電量 %
ELEVATION_DRAIN_PER_M = 0.05  # 每上升 1m 額外消耗 %
TAILWIND_FACTOR = 0.8
HEADWIND_FACTOR = 1.5
CROSSWIND_FACTOR = 1.0

# 路徑離散化：每段最長距離 (m)
MAX_SEGMENT_M = 150.0


def _bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Bearing from (lat1, lng1) to (lat2, lng2) in degrees 0-360."""
    rad = math.pi / 180.0
    d_lon = (lng2 - lng1) * rad
    y = math.sin(d_lon) * math.cos(lat2 * rad)
    x = math.cos(lat1 * rad) * math.sin(lat2 * rad) - math.sin(lat1 * rad) * math.cos(lat2 * rad) * math.cos(d_lon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def _approx_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in meters between two points."""
    d_lat = (lat2 - lat1) * METERS_PER_DEGREE_LAT
    d_lng = (lng2 - lng1) * METERS_PER_DEGREE_LAT * math.cos(math.radians(lat1))
    return math.hypot(d_lat, d_lng)


def wind_factor_from_heading(
    heading_deg: float,
    wind_speed: float,
    wind_deg: float,
    *,
    tailwind_factor: float = TAILWIND_FACTOR,
    headwind_factor: float = HEADWIND_FACTOR,
    crosswind_factor: float = CROSSWIND_FACTOR,
) -> float:
    """
    依航向與風向計算耗電係數。逆風加大消耗、順風減少。
    wind_deg 為風的來向（與 OpenWeather / weather.py 一致）。
    """
    if wind_speed <= 0:
        return crosswind_factor
    heading_rad = math.radians(heading_deg)
    wind_rad = math.radians(wind_deg)
    # 風在航向上的投影：逆風為正、順風為負（與 weather.effective_speed_m_min 同邏輯）
    wind_along = wind_speed * math.cos(heading_rad - wind_rad)
    # 側風（投影接近 0）視為 crosswind，避免浮點誤差
    if abs(wind_along) < 1e-9:
        return crosswind_factor
    if wind_along > 0:
        return headwind_factor
    return tailwind_factor


def calculate_realistic_battery_drain(
    distance_km: float,
    elevation_gain_m: float,
    heading_deg: float,
    wind_speed: float,
    wind_deg: float,
    *,
    base_drain_per_km: float = BASE_DRAIN_PER_KM,
    elevation_drain_per_m: float = ELEVATION_DRAIN_PER_M,
    tailwind_factor: float = TAILWIND_FACTOR,
    headwind_factor: float = HEADWIND_FACTOR,
) -> float:
    """
    計算一段路徑的電池消耗百分比。
    - 基礎：base_drain_per_km * distance_km
    - 風阻加權：乘上 wind_factor（順風 0.8、逆風 1.5、側風 1.0）
    - 海拔：每上升 1m 增加 elevation_drain_per_m %
    """
    wind_factor = wind_factor_from_heading(
        heading_deg, wind_speed, wind_deg,
        tailwind_factor=tailwind_factor, headwind_factor=headwind_factor,
    )
    drain = base_drain_per_km * wind_factor * distance_km
    drain += elevation_drain_per_m * max(0.0, elevation_gain_m)
    return drain


def _discretize_path(
    path: list[tuple[float, float]],
    max_segment_m: float = MAX_SEGMENT_M,
) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """
    將路徑拆成多段，每段長度不超過 max_segment_m。
    回傳 [(start, end), ...] 座標對。
    """
    if len(path) < 2:
        return []
    out: list[tuple[tuple[float, float], tuple[float, float]]] = []
    for i in range(len(path) - 1):
        start = path[i]
        end = path[i + 1]
        dist = _approx_distance_m(start[0], start[1], end[0], end[1])
        if dist <= max_segment_m:
            out.append((start, end))
        else:
            # 插點使每段 <= max_segment_m
            n = max(1, int(math.ceil(dist / max_segment_m)))
            for j in range(n):
                t0 = j / n
                t1 = (j + 1) / n
                p0 = (start[0] + t0 * (end[0] - start[0]), start[1] + t0 * (end[1] - start[1]))
                p1 = (start[0] + t1 * (end[0] - start[0]), start[1] + t1 * (end[1] - start[1]))
                out.append((p0, p1))
    return out


async def simulate_path_battery(
    path: list[tuple[float, float]],
    initial_battery_pct: float,
    get_weather: Callable[[float, float], Awaitable[dict[str, Any]]],
    get_elevation: Callable[[float, float], Awaitable[dict[str, Any]]],
    *,
    base_drain_per_km: float = BASE_DRAIN_PER_KM,
    elevation_drain_per_m: float = ELEVATION_DRAIN_PER_M,
    max_segment_m: float = MAX_SEGMENT_M,
) -> dict[str, Any]:
    """
    沿 path 試算電池消耗；若中途耗盡則截斷路徑並回傳失敗狀態與語意化 analysis。
    回傳：path, status ("ok" | "failed_low_battery"), remaining_battery_pct, analysis.
    """
    if not path or len(path) < 2:
        return {
            "path": [{"lat": p[0], "lng": p[1]} for p in path],
            "status": "ok",
            "remaining_battery_pct": initial_battery_pct,
            "analysis": "路徑過短或為空，無需飛行。",
        }

    segments = _discretize_path(path, max_segment_m)
    result_path: list[dict[str, float]] = [{"lat": path[0][0], "lng": path[0][1]}]
    remaining = initial_battery_pct
    cumulative_km = 0.0
    last_lat, last_lng = path[0][0], path[0][1]

    for (start, end) in segments:
        dist_m = _approx_distance_m(start[0], start[1], end[0], end[1])
        dist_km = dist_m / 1000.0
        bearing = _bearing_deg(start[0], start[1], end[0], end[1])
        mid_lat = (start[0] + end[0]) / 2.0
        mid_lng = (start[1] + end[1]) / 2.0

        elev_start = (await get_elevation(start[0], start[1]))["elevation_m"]
        elev_end = (await get_elevation(end[0], end[1]))["elevation_m"]
        elevation_gain = max(0.0, elev_end - elev_start)

        weather = await get_weather(mid_lat, mid_lng)
        wind_speed = float(weather.get("wind_speed", 0))
        wind_deg = float(weather.get("wind_deg", 0))

        drain = calculate_realistic_battery_drain(
            dist_km, elevation_gain, bearing, wind_speed, wind_deg,
            base_drain_per_km=base_drain_per_km,
            elevation_drain_per_m=elevation_drain_per_m,
        )

        if remaining - drain <= 0:
            # 在本段內耗盡：線性插值耗盡點
            if drain <= 0:
                ratio = 1.0
            else:
                ratio = remaining / drain
            ratio = min(1.0, max(0.0, ratio))
            exhaust_lat = start[0] + ratio * (end[0] - start[0])
            exhaust_lng = start[1] + ratio * (end[1] - start[1])
            cumulative_km += dist_km * ratio
            result_path.append({"lat": exhaust_lat, "lng": exhaust_lng})
            analysis = (
                f"預計在約 {cumulative_km:.1f} km 處耗盡，主因是遭遇 {wind_speed:.1f} m/s 強大逆風且需爬升 {elevation_gain:.0f} m。"
                if wind_speed >= 5 or elevation_gain >= 20
                else f"預計在約 {cumulative_km:.1f} km 處耗盡電量。"
            )
            return {
                "path": result_path,
                "status": "failed_low_battery",
                "remaining_battery_pct": 0.0,
                "analysis": analysis,
            }

        remaining -= drain
        cumulative_km += dist_km
        result_path.append({"lat": end[0], "lng": end[1]})
        last_lat, last_lng = end[0], end[1]

    analysis = f"任務預計達成，抵達後剩餘電量約 {remaining:.0f}%。"
    return {
        "path": result_path,
        "status": "ok",
        "remaining_battery_pct": round(remaining, 2),
        "analysis": analysis,
    }
