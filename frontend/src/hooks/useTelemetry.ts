import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  TelemetryPacket,
  FlightPathPoint,
  TelemetryByDrone,
  FlightPathByDrone,
} from "@/types/telemetry";
import {
  simulationStart,
  simulationStop,
  simulationPause,
  simulationResume,
} from "@/api/simulation";

const WS_URL =
  import.meta.env.VITE_WS_BASE_URL ??
  (import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/^http/, "ws")}/ws/telemetry`
    : typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/telemetry`
      : "ws://localhost:5173/ws/telemetry");

const DEFAULT_TELEMETRY: TelemetryPacket = {
  lat: 25.033,
  lng: 121.5654,
  alt: 120,
  heading: 45,
  speed: 0,
  battery: 100,
  wind_speed: 0,
  wind_deg: 0,
  effective_speed_m_min: 0,
  timestamp: Date.now(),
};

/** Single-drone key when backend does not send drone_id (legacy) */
const LEGACY_DRONE_KEY = 0;

export type RunState = "idle" | "running" | "paused";

export function useTelemetry() {
  const queryClient = useQueryClient();
  const [telemetryByDrone, setTelemetryByDrone] = useState<TelemetryByDrone>({});
  const [flightPathByDrone, setFlightPathByDrone] = useState<FlightPathByDrone>({});
  const [selectedDroneId, setSelectedDroneId] = useState<number>(0);
  const [runState, setRunState] = useState<RunState>("idle");
  const [connected, setConnected] = useState(false);
  const [wsKey, setWsKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pathByDroneRef = useRef<FlightPathByDrone>({});

  useEffect(() => {
    if (wsKey > 0) {
      pathByDroneRef.current = {};
      setFlightPathByDrone({});
      setTelemetryByDrone({});
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as TelemetryPacket & {
          event?: string;
          task_id?: number;
        };
        if (data.event === "arrived") {
          pathByDroneRef.current = {};
          setFlightPathByDrone({});
          setRunState("idle");
          if (typeof data.task_id === "number") {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }
          return;
        }
        const key =
          typeof data.drone_id === "number" ? data.drone_id : LEGACY_DRONE_KEY;
        setTelemetryByDrone((prev) => ({ ...prev, [key]: data }));
        pathByDroneRef.current = {
          ...pathByDroneRef.current,
          [key]: [
            ...(pathByDroneRef.current[key] ?? []),
            { lat: data.lat, lng: data.lng },
          ],
        };
        setFlightPathByDrone({ ...pathByDroneRef.current });
      } catch {
        // ignore invalid JSON
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsKey, queryClient]);

  const start = useCallback(
    async (
      droneIds: number[],
      startPosition?: { lat: number; lng: number } | null,
      destination?: { lat: number; lng: number } | null,
    ) => {
      if (droneIds.length === 0) return;
      pathByDroneRef.current = {};
      setFlightPathByDrone({});
      setTelemetryByDrone({});
      setSelectedDroneId(droneIds[0]);
      setRunState("running");
      setWsKey((k) => k + 1);
      const body: {
        drone_ids: number[];
        start_lat?: number;
        start_lng?: number;
        dest_lat?: number;
        dest_lng?: number;
      } = { drone_ids: droneIds };
      if (
        startPosition != null &&
        typeof startPosition.lat === "number" &&
        typeof startPosition.lng === "number"
      ) {
        body.start_lat = startPosition.lat;
        body.start_lng = startPosition.lng;
      }
      if (
        destination != null &&
        typeof destination.lat === "number" &&
        typeof destination.lng === "number"
      ) {
        body.dest_lat = destination.lat;
        body.dest_lng = destination.lng;
      }
      try {
        await simulationStart(body);
      } catch {
        setRunState("idle");
        // backend may be unavailable
      }
    },
    [],
  );

  const pause = useCallback(async () => {
    try {
      await simulationPause();
      setRunState("paused");
    } catch {
      // ignore
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await simulationResume();
      setRunState("running");
    } catch {
      // ignore
    }
  }, []);

  const stop = useCallback(async () => {
    setRunState("idle");
    try {
      await simulationStop();
    } catch {
      // ignore
    }
  }, []);

  /** Clear flight path and set run state to idle (e.g. after task cancelled). Keeps last telemetry so map does not jump to stale lastPositionByDrone. */
  const clearFlightPathAndIdle = useCallback(() => {
    pathByDroneRef.current = {};
    setFlightPathByDrone({});
    setRunState("idle");
  }, []);

  const droneIds = Object.keys(telemetryByDrone)
    .map(Number)
    .filter((id) => id !== LEGACY_DRONE_KEY || Object.keys(telemetryByDrone).length === 1);
  if (droneIds.length === 0 && Object.keys(telemetryByDrone).length > 0) {
    droneIds.push(LEGACY_DRONE_KEY);
  }

  useEffect(() => {
    if (droneIds.length > 0 && !droneIds.includes(selectedDroneId)) {
      setSelectedDroneId(droneIds[0]);
    }
  }, [droneIds.join(",")]);

  const telemetry = telemetryByDrone[selectedDroneId] ?? DEFAULT_TELEMETRY;
  const flightPath = flightPathByDrone[selectedDroneId] ?? [];

  const isRunning = runState !== "idle";
  const isPaused = runState === "paused";

  return {
    telemetry,
    flightPath,
    telemetryByDrone,
    flightPathByDrone,
    selectedDroneId,
    setSelectedDroneId,
    droneIds,
    runState,
    setRunState,
    isRunning,
    isPaused,
    connected,
    start,
    pause,
    resume,
    stop,
    clearFlightPathAndIdle,
  };
}
