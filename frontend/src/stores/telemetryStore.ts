import { create } from "zustand";
import type { TelemetryByDrone, FlightPathByDrone } from "@/types/telemetry";

/**
 * Optional global telemetry state. useTelemetry can write here so components
 * that only need a subset (e.g. one drone) can subscribe with a selector
 * to reduce re-renders. Currently useTelemetry keeps state locally; migrate
 * here when consolidating WebSocket updates.
 */
export interface TelemetryState {
  telemetryByDrone: TelemetryByDrone;
  flightPathByDrone: FlightPathByDrone;
  setTelemetryByDrone: (by: TelemetryByDrone | ((prev: TelemetryByDrone) => TelemetryByDrone)) => void;
  setFlightPathByDrone: (by: FlightPathByDrone | ((prev: FlightPathByDrone) => FlightPathByDrone)) => void;
  reset: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetryByDrone: {},
  flightPathByDrone: {},
  setTelemetryByDrone: (by) =>
    set((s) => ({
      telemetryByDrone: typeof by === "function" ? by(s.telemetryByDrone) : by,
    })),
  setFlightPathByDrone: (by) =>
    set((s) => ({
      flightPathByDrone: typeof by === "function" ? by(s.flightPathByDrone) : by,
    })),
  reset: () =>
    set({ telemetryByDrone: {}, flightPathByDrone: {} }),
}));
