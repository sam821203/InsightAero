"""Tests for battery_planning: wind factor, realistic drain, path simulation and truncation."""
import asyncio
import math

import pytest

from app.services.battery_planning import (
    BASE_DRAIN_PER_KM,
    ELEVATION_DRAIN_PER_M,
    calculate_realistic_battery_drain,
    simulate_path_battery,
    wind_factor_from_heading,
)


def test_wind_factor_no_wind():
    """無風時係數為 1.0（側風/無風）。"""
    assert wind_factor_from_heading(0.0, 0.0, 0.0) == 1.0
    assert wind_factor_from_heading(90.0, 0.0, 180.0) == 1.0


def test_wind_factor_headwind():
    """逆風：航向 0（北），風從北來（wind_deg=0），投影為正，係數 1.5。"""
    f = wind_factor_from_heading(0.0, 5.0, 0.0)
    assert abs(f - 1.5) < 1e-6


def test_wind_factor_tailwind():
    """順風：航向 0（北），風從南來（wind_deg=180），投影為負，係數 0.8。"""
    f = wind_factor_from_heading(0.0, 5.0, 180.0)
    assert abs(f - 0.8) < 1e-6


def test_wind_factor_crosswind():
    """側風：航向 0（北），風從東來（wind_deg=90），投影為 0，係數 1.0。"""
    f = wind_factor_from_heading(0.0, 5.0, 90.0)
    assert abs(f - 1.0) < 1e-6


def test_calculate_realistic_battery_drain_no_wind():
    """無風、無爬升：僅基礎耗電。"""
    drain = calculate_realistic_battery_drain(
        1.0, 0.0, 0.0, 0.0, 0.0
    )
    assert abs(drain - BASE_DRAIN_PER_KM * 1.0) < 1e-6


def test_calculate_realistic_battery_drain_headwind():
    """逆風：耗電為基礎的 1.5 倍。"""
    drain = calculate_realistic_battery_drain(
        1.0, 0.0, 0.0, 5.0, 0.0
    )
    expected = BASE_DRAIN_PER_KM * 1.5 * 1.0
    assert abs(drain - expected) < 1e-6


def test_calculate_realistic_battery_drain_tailwind():
    """順風：耗電為基礎的 0.8 倍。"""
    drain = calculate_realistic_battery_drain(
        1.0, 0.0, 0.0, 5.0, 180.0
    )
    expected = BASE_DRAIN_PER_KM * 0.8 * 1.0
    assert abs(drain - expected) < 1e-6


def test_calculate_realistic_battery_drain_elevation():
    """有爬升：額外消耗 elevation_drain_per_m * elevation_gain。"""
    drain_no_climb = calculate_realistic_battery_drain(
        0.5, 0.0, 90.0, 0.0, 0.0
    )
    drain_climb = calculate_realistic_battery_drain(
        0.5, 100.0, 90.0, 0.0, 0.0
    )
    extra = 100.0 * ELEVATION_DRAIN_PER_M
    assert abs((drain_climb - drain_no_climb) - extra) < 1e-6


def test_simulate_path_battery_success_short():
    """短距離、無風無爬升：應完成且剩餘電量合理。"""
    path = [(25.0, 121.0), (25.001, 121.0)]  # ~111 m 緯度方向

    async def mock_weather(lat: float, lng: float):
        return {"wind_speed": 0.0, "wind_deg": 0.0}

    async def mock_elevation(lat: float, lng: float):
        return {"elevation_m": 0.0, "resolution_m": 0.0}

    result = asyncio.run(simulate_path_battery(
        path, 100.0, mock_weather, mock_elevation
    ))
    assert result["status"] == "ok"
    assert result["remaining_battery_pct"] < 100.0
    assert result["remaining_battery_pct"] > 0.0
    assert "任務預計達成" in result["analysis"]
    assert len(result["path"]) >= 2


def test_simulate_path_battery_failed_low_battery():
    """強逆風 + 爬升：應截斷、status failed_low_battery、analysis 含關鍵字。"""
    # 較長路徑且僅 5% 電量，逆風 15 m/s + 爬升，必耗盡
    path = [(25.0, 121.0), (25.01, 121.0), (25.02, 121.0)]

    async def mock_weather(lat: float, lng: float):
        return {"wind_speed": 15.0, "wind_deg": 0.0}

    async def mock_elevation(lat: float, lng: float):
        return {"elevation_m": 100.0 + (lat - 25.0) * 5000, "resolution_m": 0.0}

    result = asyncio.run(simulate_path_battery(
        path, 5.0, mock_weather, mock_elevation
    ))
    assert result["status"] == "failed_low_battery"
    assert result["remaining_battery_pct"] == 0.0
    assert "耗盡" in result["analysis"]
    assert len(result["path"]) >= 2
    assert result["path"][-1]["lat"] <= 25.01


def test_simulate_path_battery_empty_path():
    """空路徑或單點：回傳 ok 且無飛行。"""
    async def mock_weather(lat: float, lng: float):
        return {"wind_speed": 0.0, "wind_deg": 0.0}

    async def mock_elevation(lat: float, lng: float):
        return {"elevation_m": 0.0, "resolution_m": 0.0}

    r1 = asyncio.run(simulate_path_battery([], 100.0, mock_weather, mock_elevation))
    assert r1["status"] == "ok"
    assert r1["path"] == []
    assert "路徑過短或為空" in r1["analysis"]

    r2 = asyncio.run(simulate_path_battery([(25.0, 121.0)], 100.0, mock_weather, mock_elevation))
    assert r2["status"] == "ok"
    assert len(r2["path"]) == 1
