"""Tests for wind_compensation: vector-based ground speed and position update."""
import math

import pytest

from app.services.wind_compensation import (
    METERS_PER_DEGREE_LAT,
    heading_for_ground_track,
    wind_compensation,
)


def test_north_flight_east_wind_60_sec():
    """正北飛行、強勁東風、60 秒：地速 (10, -5) → 向北 600 m、向西 300 m。"""
    lat0, lon0 = 25.0, 121.0
    target_heading = 0.0  # 正北
    air_speed = 10.0  # m/s
    wind_speed = 5.0  # m/s
    wind_deg = 90.0  # 東風（風從東邊來）
    dt = 60.0

    (new_lat, new_lon), ground_speed = wind_compensation(
        (lat0, lon0), target_heading, air_speed, wind_speed, wind_deg, dt
    )

    # 地速向量 (北, 東) = (10, -5) → |v| = √125
    expected_ground_speed = math.sqrt(10.0**2 + 5.0**2)
    assert abs(ground_speed - expected_ground_speed) < 1e-6

    # 位移：向北 600 m、向西 300 m
    expected_d_lat = 600.0 / METERS_PER_DEGREE_LAT
    expected_d_lon = -300.0 / (METERS_PER_DEGREE_LAT * math.cos(math.radians(lat0)))
    expected_lat = lat0 + expected_d_lat
    expected_lon = lon0 + expected_d_lon
    assert abs(new_lat - expected_lat) < 1e-6
    assert abs(new_lon - expected_lon) < 1e-6


def test_no_wind():
    """無風：地速等於空速，位移沿航向。"""
    lat0, lon0 = 25.0, 121.0
    target_heading = 90.0  # 正東
    air_speed = 10.0
    wind_speed = 0.0
    wind_deg = 0.0
    dt = 60.0

    (new_lat, new_lon), ground_speed = wind_compensation(
        (lat0, lon0), target_heading, air_speed, wind_speed, wind_deg, dt
    )

    assert abs(ground_speed - air_speed) < 1e-6
    # 向東 600 m
    expected_d_lon = 600.0 / (METERS_PER_DEGREE_LAT * math.cos(math.radians(lat0)))
    assert abs(new_lat - lat0) < 1e-6
    assert abs(new_lon - (lon0 + expected_d_lon)) < 1e-6


def test_headwind():
    """逆風：航向 0（北），風從北來（wind_deg=0），地速 = 空速 - 風速。"""
    lat0, lon0 = 25.0, 121.0
    target_heading = 0.0
    air_speed = 10.0
    wind_speed = 3.0
    wind_deg = 0.0  # 北風（從北邊來）
    dt = 60.0

    (new_lat, new_lon), ground_speed = wind_compensation(
        (lat0, lon0), target_heading, air_speed, wind_speed, wind_deg, dt
    )

    # 地速向北 = 10 - 3 = 7 m/s
    assert abs(ground_speed - 7.0) < 1e-6
    expected_d_lat = 7.0 * 60.0 / METERS_PER_DEGREE_LAT
    assert abs(new_lat - (lat0 + expected_d_lat)) < 1e-6
    assert abs(new_lon - lon0) < 1e-6


def test_heading_for_ground_track_no_wind():
    """無風時機頭應等於 bearing，無修正角。"""
    bearing = 60.0
    air_speed = 12.5
    heading = heading_for_ground_track(bearing, air_speed, 0.0, 0.0)
    assert abs(heading - bearing) < 1e-6


def test_heading_for_ground_track_toward_bearing():
    """有風時：用 heading_for_ground_track 得到的機頭飛行，地速方向應對準 bearing。"""
    lat0, lon0 = 25.0, 121.0
    bearing_deg = 50.0  # 東偏北
    air_speed = 12.5
    wind_speed = 9.3
    wind_deg = 360.0  # 北風（從北來）
    dt = 1.0

    heading = heading_for_ground_track(
        bearing_deg, air_speed, wind_speed, wind_deg
    )
    (new_lat, new_lon), _ = wind_compensation(
        (lat0, lon0), heading, air_speed, wind_speed, wind_deg, dt
    )
    d_lat = new_lat - lat0
    d_lon = new_lon - lon0
    d_north_m = d_lat * METERS_PER_DEGREE_LAT
    d_east_m = d_lon * METERS_PER_DEGREE_LAT * math.cos(math.radians(lat0))
    track_deg = math.degrees(math.atan2(d_east_m, d_north_m)) % 360.0
    # 地速方向應與 bearing 一致，容許 1° 內
    diff = abs(track_deg - bearing_deg)
    if diff > 180:
        diff = 360 - diff
    assert diff < 1.0
