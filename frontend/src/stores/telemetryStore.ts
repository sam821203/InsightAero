import { create } from "zustand";
import type {
  FlightPathByDrone,
  TelemetryByDrone,
  TelemetryPacket,
} from "@/types/telemetry";

export type RunState = "idle" | "running" | "paused";

/** Packets without drone_id come from the legacy single-drone simulator. */
export const LEGACY_DRONE_KEY = 0;

/**
 * Keeps memory bounded on long missions. At one packet per 0.5 s this is
 * about 40 minutes of trail per drone.
 */
export const MAX_PATH_POINTS = 5000;

export const DEFAULT_TELEMETRY: TelemetryPacket = {
  lat: 25.033,
  lng: 121.5654,
  alt: 120,
  heading: 45,
  speed: 0,
  battery: 100,
  wind_speed: 0,
  wind_deg: 0,
  effective_speed_m_min: 0,
  timestamp: 0,
};

interface TelemetryState {
  byDrone: TelemetryByDrone;
  pathByDrone: FlightPathByDrone;
  selectedDroneId: number;
  runState: RunState;
  connected: boolean;

  /** Apply a batch of packets in one update (one re-render for subscribers). */
  ingest: (packets: TelemetryPacket[]) => void;
  selectDrone: (droneId: number) => void;
  setRunState: (runState: RunState) => void;
  setConnected: (connected: boolean) => void;
  /** Drop trails and go idle, keeping the last packets so markers don't jump. */
  clearPathsAndIdle: () => void;
}

/** Drone IDs with live telemetry. The legacy key only counts when it's alone. */
export function liveDroneIdsOf(byDrone: TelemetryByDrone): number[] {
  const ids = Object.keys(byDrone).map(Number);
  const real = ids.filter((id) => id !== LEGACY_DRONE_KEY);
  return real.length > 0 ? real : ids;
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Auto-select only when the set of live drones changes (a drone starts or
 * stops sending) and the current selection isn't among them. Between those
 * changes, keep whatever the user picked, including a drone that is on the
 * map but not flying.
 */
function nextSelection(
  selected: number,
  before: TelemetryByDrone,
  after: TelemetryByDrone
): number {
  const liveAfter = liveDroneIdsOf(after);
  if (sameIds(liveDroneIdsOf(before), liveAfter)) return selected;
  return liveAfter.includes(selected) ? selected : liveAfter[0];
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  byDrone: {},
  pathByDrone: {},
  selectedDroneId: LEGACY_DRONE_KEY,
  runState: "idle",
  connected: false,

  ingest: (packets) =>
    set((state) => {
      if (packets.length === 0) return state;
      // Only drones present in this batch get new references; the others keep
      // theirs, so selectors watching them don't re-render.
      const byDrone = { ...state.byDrone };
      const pathByDrone = { ...state.pathByDrone };
      for (const packet of packets) {
        const key = typeof packet.drone_id === "number" ? packet.drone_id : LEGACY_DRONE_KEY;
        const path = [...(pathByDrone[key] ?? []), { lat: packet.lat, lng: packet.lng }];
        if (path.length > MAX_PATH_POINTS) path.splice(0, path.length - MAX_PATH_POINTS);
        byDrone[key] = packet;
        pathByDrone[key] = path;
      }
      return {
        byDrone,
        pathByDrone,
        selectedDroneId: nextSelection(state.selectedDroneId, state.byDrone, byDrone),
      };
    }),

  selectDrone: (selectedDroneId) => set({ selectedDroneId }),
  setRunState: (runState) => set({ runState }),
  setConnected: (connected) => set({ connected }),
  clearPathsAndIdle: () => set({ pathByDrone: {}, runState: "idle" }),
}));

/* Selectors. Keep them outside components so they're stable references. */

export const selectActiveTelemetry = (s: TelemetryState): TelemetryPacket =>
  s.byDrone[s.selectedDroneId] ?? DEFAULT_TELEMETRY;

export const selectActivePath = (s: TelemetryState) => s.pathByDrone[s.selectedDroneId];

export const selectIsRunning = (s: TelemetryState) => s.runState !== "idle";

export const selectHasLiveTelemetry = (s: TelemetryState) =>
  Object.keys(s.byDrone).length > 0;
