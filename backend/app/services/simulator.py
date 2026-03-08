"""模擬器：依週期產生遙測並透過 WebSocket 推播。整合 OpenWeather 做有效分速修正。支援多機、每台獨立起終點與 per-instance 抵達 callback。"""
import asyncio
import math
import random
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

from app.config import SIM_LAT, SIM_LNG
from app.services.weather import get_weather
from app.services.wind_compensation import heading_for_ground_track, wind_compensation

METERS_PER_DEGREE_LAT = 111320
INTERVAL_SEC = 0.5
BASE_SPEED_M_MIN = 750.0
# 取天氣不阻塞首個 tick，逾時則沿用上次風速（預設 0）
WEATHER_FETCH_TIMEOUT_SEC = 2.0
# 多機時每台起點略為錯開（經緯度偏移約 10m 量級）
INSTANCE_OFFSET_DEG = 0.0001
# 與終點距離少於此值（公尺）視為抵達
ARRIVAL_THRESHOLD_M = 5.0


def _make_instance(
    drone_id: int,
    session_id: int,
    index: int,
    base_lat: float,
    base_lng: float,
    dest_lat: float | None = None,
    dest_lng: float | None = None,
    task_id: int | None = None,
    on_arrival: Callable[[], Awaitable[None]] | None = None,
    on_low_battery: Callable[[], Awaitable[None]] | None = None,
) -> dict[str, Any]:
    inst: dict[str, Any] = {
        "lat": base_lat + index * INSTANCE_OFFSET_DEG,
        "lng": base_lng + index * INSTANCE_OFFSET_DEG,
        "alt": 120.0,
        "heading": 45.0 + index * 15,
        "battery": 100.0,
        "drone_id": drone_id,
        "session_id": session_id,
    }
    if dest_lat is not None and dest_lng is not None:
        inst["dest_lat"] = dest_lat
        inst["dest_lng"] = dest_lng
    if task_id is not None:
        inst["task_id"] = task_id
    if on_arrival is not None:
        inst["on_arrival"] = on_arrival
    if on_low_battery is not None:
        inst["on_low_battery"] = on_low_battery
    return inst


def _bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Bearing from (lat1, lng1) to (lat2, lng2) in degrees 0-360."""
    rad = math.pi / 180.0
    d_lon = (lng2 - lng1) * rad
    y = math.sin(d_lon) * math.cos(lat2 * rad)
    x = math.cos(lat1 * rad) * math.sin(lat2 * rad) - math.sin(lat1 * rad) * math.cos(lat2 * rad) * math.cos(d_lon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def _approx_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in meters (for arrival threshold)."""
    d_lat = (lat2 - lat1) * METERS_PER_DEGREE_LAT
    d_lng = (lng2 - lng1) * METERS_PER_DEGREE_LAT * math.cos(math.radians(lat1))
    return math.hypot(d_lat, d_lng)


class TelemetrySimulator:
    def __init__(self):
        self._running = False
        self._paused = False
        self._paused_tasks: set[int] = set()  # task_id of tasks that are paused
        self._task: asyncio.Task[None] | None = None
        self._broadcast: list[asyncio.Queue[dict[str, Any]]] = []
        self._instances: list[dict[str, Any]] = []
        self._wind_speed = 0.0
        self._wind_deg = 0.0
        # Legacy single-run: shared dest and one callback when all arrive
        self._dest_lat: float | None = None
        self._dest_lng: float | None = None
        self._on_arrival: Callable[[], Awaitable[None]] | None = None

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._broadcast.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        if q in self._broadcast:
            self._broadcast.remove(q)

    def broadcast_event(self, event: dict[str, Any]) -> None:
        """Push an event (e.g. arrived, task_completed) to all WebSocket subscribers."""
        for q in self._broadcast:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def _tick(self) -> None:
        if not self._instances:
            return
        first = self._instances[0]
        try:
            weather = await asyncio.wait_for(
                get_weather(first["lat"], first["lng"]),
                timeout=WEATHER_FETCH_TIMEOUT_SEC,
            )
            self._wind_speed = weather["wind_speed"]
            self._wind_deg = weather["wind_deg"]
        except (Exception, asyncio.TimeoutError):
            pass

        ts_ms = int(datetime.utcnow().timestamp() * 1000)
        legacy_dest_lat = self._dest_lat
        legacy_dest_lng = self._dest_lng
        to_remove: list[dict[str, Any]] = []
        drain = 0.05 + (0.03 if self._wind_speed > 30 else 0)
        for inst in self._instances:
            task_id = inst.get("task_id")
            if task_id is not None and task_id in self._paused_tasks:
                continue
            # 電池耗盡：不更新位置、送最後一筆 packet、觸發 on_low_battery、移除
            if inst["battery"] <= 0 or inst["battery"] - drain <= 0:
                inst["battery"] = 0.0
                packet: dict[str, Any] = {
                    "lat": round(inst["lat"], 6),
                    "lng": round(inst["lng"], 6),
                    "alt": round(inst["alt"], 1),
                    "heading": round(inst["heading"], 1),
                    "speed": 0.0,
                    "battery": 0.0,
                    "wind_speed": round(self._wind_speed, 1),
                    "wind_deg": round(self._wind_deg, 1),
                    "effective_speed_m_min": 0.0,
                    "timestamp": ts_ms,
                }
                if inst.get("drone_id") is not None:
                    packet["drone_id"] = inst["drone_id"]
                if inst.get("session_id") is not None:
                    packet["session_id"] = inst["session_id"]
                for q in self._broadcast:
                    try:
                        q.put_nowait(packet)
                    except asyncio.QueueFull:
                        pass
                to_remove.append(inst)
                if inst.get("on_low_battery") is not None:
                    cb = inst["on_low_battery"]
                    asyncio.create_task(cb())
                continue

            dest_lat = inst.get("dest_lat", legacy_dest_lat)
            dest_lng = inst.get("dest_lng", legacy_dest_lng)
            air_speed_m_s = BASE_SPEED_M_MIN / 60.0
            if dest_lat is not None and dest_lng is not None:
                target_heading = _bearing_deg(
                    inst["lat"], inst["lng"], dest_lat, dest_lng
                )
                inst["heading"] = (
                    heading_for_ground_track(
                        target_heading,
                        air_speed_m_s,
                        self._wind_speed,
                        self._wind_deg,
                    )
                    + (random.random() * 6 - 3)
                    + 360
                ) % 360
            else:
                inst["heading"] = (
                    inst["heading"] + (random.random() * 6 - 3) + 360
                ) % 360
            (inst["lat"], inst["lng"]), ground_speed_m_s = wind_compensation(
                (inst["lat"], inst["lng"]),
                inst["heading"],
                air_speed_m_s,
                self._wind_speed,
                self._wind_deg,
                INTERVAL_SEC,
            )
            speed_m_per_sec = max(ground_speed_m_s, 50.0 / 60.0)
            eff = speed_m_per_sec * 60.0
            inst["alt"] = max(50, min(300, inst["alt"] + (random.random() * 10 - 5)))
            inst["battery"] = max(0, inst["battery"] - drain)
            packet = {
                "lat": round(inst["lat"], 6),
                "lng": round(inst["lng"], 6),
                "alt": round(inst["alt"], 1),
                "heading": round(inst["heading"], 1),
                "speed": round(speed_m_per_sec * 60, 1),
                "battery": round(inst["battery"], 2),
                "wind_speed": round(self._wind_speed, 1),
                "wind_deg": round(self._wind_deg, 1),
                "effective_speed_m_min": round(eff, 1),
                "timestamp": ts_ms,
            }
            if inst.get("drone_id") is not None:
                packet["drone_id"] = inst["drone_id"]
            if inst.get("session_id") is not None:
                packet["session_id"] = inst["session_id"]
            for q in self._broadcast:
                try:
                    q.put_nowait(packet)
                except asyncio.QueueFull:
                    pass

            # Per-instance arrival: only when instance has its own dest and on_arrival (task-based)
            check_lat = inst.get("dest_lat")
            check_lng = inst.get("dest_lng")
            if check_lat is not None and check_lng is not None and inst.get("on_arrival") is not None:
                if _approx_distance_m(inst["lat"], inst["lng"], check_lat, check_lng) <= ARRIVAL_THRESHOLD_M:
                    to_remove.append(inst)
                    cb = inst["on_arrival"]
                    asyncio.create_task(cb())

        for inst in to_remove:
            if inst in self._instances:
                self._instances.remove(inst)

        # Legacy: shared dest and all instances in same batch (no task_id) — when all arrived, trigger
        if legacy_dest_lat is not None and legacy_dest_lng is not None and self._on_arrival is not None:
            legacy_instances = [i for i in self._instances if i.get("task_id") is None and "dest_lat" not in i]
            all_arrived = all(
                _approx_distance_m(inst["lat"], inst["lng"], legacy_dest_lat, legacy_dest_lng)
                <= ARRIVAL_THRESHOLD_M
                for inst in legacy_instances
            ) if legacy_instances else False
            if all_arrived:
                for q in self._broadcast:
                    try:
                        q.put_nowait({"event": "arrived"})
                    except asyncio.QueueFull:
                        pass
                self._running = False
                cb = self._on_arrival
                self._on_arrival = None
                if cb is not None:
                    asyncio.create_task(cb())

    async def _loop(self) -> None:
        while self._running:
            if not self._paused:
                await self._tick()
            await asyncio.sleep(INTERVAL_SEC)

    def start(
        self,
        drone_session_pairs: list[tuple[int, int]] | None = None,
        start_lat: float | None = None,
        start_lng: float | None = None,
        dest_lat: float | None = None,
        dest_lng: float | None = None,
        on_arrival: Callable[[], Awaitable[None]] | None = None,
    ) -> None:
        if self._running:
            return
        self._running = True
        self._dest_lat = dest_lat
        self._dest_lng = dest_lng
        self._on_arrival = on_arrival
        base_lat = start_lat if start_lat is not None else SIM_LAT
        base_lng = start_lng if start_lng is not None else SIM_LNG
        pairs = list(drone_session_pairs or [])
        if pairs:
            self._instances = [
                _make_instance(did, sid, i, base_lat, base_lng)
                for i, (did, sid) in enumerate(pairs)
            ]
        else:
            self._instances = [
                {
                    "lat": base_lat,
                    "lng": base_lng,
                    "alt": 120.0,
                    "heading": 45.0,
                    "battery": 100.0,
                    "drone_id": None,
                    "session_id": None,
                }
            ]
        self._task = asyncio.create_task(self._loop())

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    def pause_task(self, task_id: int) -> None:
        self._paused_tasks.add(task_id)

    def resume_task(self, task_id: int) -> None:
        self._paused_tasks.discard(task_id)

    def remove_task_instances(self, task_id: int) -> None:
        """Remove all instances for this task (e.g. on cancel)."""
        self._instances = [i for i in self._instances if i.get("task_id") != task_id]

    def add_instances(
        self,
        task_id: int,
        instances: list[
            tuple[int, int, float, float, float, float, Callable[[], Awaitable[None]] | None, Callable[[], Awaitable[None]] | None]
            | tuple[int, int, float, float, float, float, Callable[[], Awaitable[None]] | None]
        ],
    ) -> None:
        """
        Add instances for a task. Each item: (drone_id, session_id, start_lat, start_lng, dest_lat, dest_lng, on_arrival_cb[, on_low_battery_cb]).
        Starts the loop if not running.
        """
        for i, spec in enumerate(instances):
            drone_id, session_id, start_lat, start_lng, dest_lat, dest_lng, on_arrival = spec[:7]
            on_low_battery = spec[7] if len(spec) >= 8 else None
            inst = _make_instance(
                drone_id, session_id, i, start_lat, start_lng,
                dest_lat=dest_lat, dest_lng=dest_lng, task_id=task_id, on_arrival=on_arrival, on_low_battery=on_low_battery,
            )
            self._instances.append(inst)
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self._running = False
        self._paused = False
        self._paused_tasks.clear()
        self._instances = []
        self._dest_lat = None
        self._dest_lng = None
        self._on_arrival = None
        if self._task:
            self._task.cancel()
            self._task = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def is_paused(self) -> bool:
        return self._paused


# 單例
_simulator: TelemetrySimulator | None = None


def get_simulator() -> TelemetrySimulator:
    global _simulator
    if _simulator is None:
        _simulator = TelemetrySimulator()
    return _simulator
