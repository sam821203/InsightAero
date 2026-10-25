/** Flight math and status thresholds used by the telemetry bar. */

export type Level = "nominal" | "warning" | "critical";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Minutes to cover `meters` at `speedMetersPerMinute`, or null if not moving. */
export function etaMinutes(meters: number, speedMetersPerMinute: number): number | null {
  if (!(speedMetersPerMinute > 0)) return null;
  return meters / speedMetersPerMinute;
}

/* Battery: matches the previous HUD thresholds. */
export const BATTERY_WARNING_PCT = 60;
export const BATTERY_CRITICAL_PCT = 25;

export function batteryLevel(percent: number): Level {
  if (percent > BATTERY_WARNING_PCT) return "nominal";
  if (percent > BATTERY_CRITICAL_PCT) return "warning";
  return "critical";
}

/*
 * Wind: typical limits for small multirotors. Most are rated for sustained
 * wind around 10–12 m/s, so warn before that and flag beyond it.
 */
export const WIND_WARNING_MS = 8;
export const WIND_CRITICAL_MS = 12;

export function windLevel(speed: number): Level {
  if (speed < WIND_WARNING_MS) return "nominal";
  if (speed <= WIND_CRITICAL_MS) return "warning";
  return "critical";
}

export type WindRelation = "headwind" | "tailwind" | "crosswind";

/** Below this along-track component (m/s), wind is treated as crosswind. */
const ALONG_TRACK_THRESHOLD_MS = 1;

/**
 * Whether the wind is mostly against or behind the drone.
 * `windDeg` is where the wind comes from (meteorological convention), the same
 * convention the backend uses for effective speed.
 */
export function windRelation(headingDeg: number, windSpeed: number, windDeg: number): WindRelation {
  const along = windSpeed * Math.cos(((headingDeg - windDeg) * Math.PI) / 180);
  if (along > ALONG_TRACK_THRESHOLD_MS) return "headwind";
  if (along < -ALONG_TRACK_THRESHOLD_MS) return "tailwind";
  return "crosswind";
}
