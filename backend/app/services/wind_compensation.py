"""
風力位移模擬（Wind Compensation）：向量合成法計算無人機受風影響的實際位置與地速。

公式：實際地速 (Ground Speed) = 無人機動力速度 (Air Speed) + 風速 (Wind Speed)，皆為向量。
座標慣例：0° = 正北（+lat）、90° = 正東（+lon）；平面分量為 (北向 m, 東向 m)。
經緯度換算常數與 simulator 一致（METERS_PER_DEGREE_LAT = 111320）。
"""

import math
from typing import Tuple

# 與 simulator 一致：1 度緯度約 111320 公尺
METERS_PER_DEGREE_LAT = 111320


def heading_for_ground_track(
    bearing_deg: float,
    air_speed: float,
    wind_speed: float,
    wind_deg: float,
) -> float:
    """
    求使地速方向對準 bearing 的機頭角（風修正角 / crab angle）。

    令地速 = 空速 + 風速，要求地速方向 = bearing，反解出機頭 heading。
    若無法保持該航跡（如強逆風），回傳 bearing_deg 不修正。

    參數
    -----
    bearing_deg : 期望地速方向（0–360°，0 為正北）
    air_speed : 空速 (m/s)
    wind_speed : 風速 (m/s)，OpenWeather 來向
    wind_deg : 風向 (0–360)，OpenWeather 來向

    回傳
    -----
    機頭朝向 (0–360°)，使地速方向對準 bearing。
    """
    if wind_speed <= 0:
        return bearing_deg
    # 風向量 (北, 東)：來向 → 去向
    wind_disp_deg = (wind_deg + 180.0) % 360.0
    wind_disp_rad = math.radians(wind_disp_deg)
    wind_north = wind_speed * math.cos(wind_disp_rad)
    wind_east = wind_speed * math.sin(wind_disp_rad)
    # 單位 bearing 向量 (北, 東)
    bearing_rad = math.radians(bearing_deg)
    u_north = math.cos(bearing_rad)
    u_east = math.sin(bearing_rad)
    wind_dot_u = wind_north * u_north + wind_east * u_east
    disc = wind_dot_u**2 - wind_speed**2 + air_speed**2
    if disc < 0:
        return bearing_deg
    k = wind_dot_u + math.sqrt(disc)
    if k <= 0:
        return bearing_deg
    air_north = k * u_north - wind_north
    air_east = k * u_east - wind_east
    heading_rad = math.atan2(air_east, air_north)
    return (math.degrees(heading_rad) + 360.0) % 360.0


def wind_compensation(
    current_coords: Tuple[float, float],
    target_heading: float,
    air_speed: float,
    wind_speed: float,
    wind_deg: float,
    dt: float,
) -> Tuple[Tuple[float, float], float]:
    """
    依當前位置、航向、空速與風場，計算 dt 秒後的經緯度與實際地速。

    參數
    -----
    current_coords : (lat, lon) 當前經緯度（度）
    target_heading : 無人機動力朝向，0–360 度，0 為正北
    air_speed : 無人機自身動力速度 (m/s)
    wind_speed : 風速 (m/s)，來自 OpenWeather
    wind_deg : 風向 (0–360)，來自 OpenWeather，為風的「來向」
    dt : 模擬時間步長 (秒)

    回傳
    -----
    ((new_lat, new_lon), ground_speed_m_s)
    - new_lat, new_lon : 更新後的經緯度（度）
    - ground_speed_m_s : 當前實際地速大小 (m/s)
    """
    lat, lon = current_coords

    # --- 1. 航向 → 空速向量 (北, 東) m/s ---
    # 慣例：0° = 北 → +北向；90° = 東 → +東向
    heading_rad = math.radians(target_heading)
    air_north = air_speed * math.cos(heading_rad)
    air_east = air_speed * math.sin(heading_rad)

    # --- 2. 風向轉換：氣象「來向」→ 位移向量（風的去向）---
    # OpenWeather wind_deg = 風從哪來。風推動無人機的位移方向 = 風的去向 = (wind_deg + 180) °
    wind_disp_deg = (wind_deg + 180.0) % 360.0
    wind_disp_rad = math.radians(wind_disp_deg)
    wind_north = wind_speed * math.cos(wind_disp_rad)
    wind_east = wind_speed * math.sin(wind_disp_rad)

    # --- 3. 合速度（地速向量）---
    ground_north = air_north + wind_north
    ground_east = air_east + wind_east
    ground_speed_m_s = math.hypot(ground_north, ground_east)

    # --- 4. 位移 (m) = 地速 × dt ---
    d_north_m = ground_north * dt
    d_east_m = ground_east * dt

    # --- 5. 公尺 → 經緯度 ---
    # 1° 緯度 ≈ 111320 m；1° 經度 ≈ 111320 * cos(lat) m
    d_lat = d_north_m / METERS_PER_DEGREE_LAT
    meters_per_deg_lon = METERS_PER_DEGREE_LAT * math.cos(math.radians(lat))
    d_lon = d_east_m / meters_per_deg_lon

    new_lat = lat + d_lat
    new_lon = lon + d_lon

    return (new_lat, new_lon), ground_speed_m_s


if __name__ == "__main__":
    # 簡單測試：正北飛行、強勁東風、60 秒
    lat0, lon0 = 25.0, 121.0
    target_heading = 0.0  # 正北
    air_speed = 10.0  # m/s
    wind_speed = 5.0  # m/s
    wind_deg = 90.0  # 東風（風從東邊來）
    dt = 60.0  # 秒

    (new_lat, new_lon), ground_speed = wind_compensation(
        (lat0, lon0), target_heading, air_speed, wind_speed, wind_deg, dt
    )

    # 預期：地速 (北, 東) = (10, -5) → 向北 600 m、向西 300 m
    expected_d_north = 600.0
    expected_d_east = -300.0
    expected_d_lat = expected_d_north / METERS_PER_DEGREE_LAT
    expected_d_lon = expected_d_east / (METERS_PER_DEGREE_LAT * math.cos(math.radians(lat0)))
    expected_lat = lat0 + expected_d_lat
    expected_lon = lon0 + expected_d_lon

    print("Wind Compensation 範例：正北飛行 + 東風 60 秒")
    print(f"  起點: ({lat0}, {lon0})")
    print(f"  航向: {target_heading}° (正北), 空速: {air_speed} m/s")
    print(f"  風: {wind_speed} m/s from {wind_deg}° (東風)")
    print(f"  地速: {ground_speed:.2f} m/s (預期 √125 ≈ 11.18)")
    print(f"  終點: ({new_lat:.6f}, {new_lon:.6f})")
    print(f"  預期終點: ({expected_lat:.6f}, {expected_lon:.6f})")
    print(f"  緯度差: {abs(new_lat - expected_lat):.2e}, 經度差: {abs(new_lon - expected_lon):.2e}")
