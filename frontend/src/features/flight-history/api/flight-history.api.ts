import { apiFetch } from "@/api/client";

export interface FlightSessionItem {
  id: number;
  drone_id: number | null;
  drone_name: string | null;
  start_time: string | null;
  end_time: string | null;
  weather_snapshot: string | null;
}

export interface TelemetryRecord {
  id: number;
  session_id: number | null;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  heading: number;
  battery: number;
  wind_speed: number;
  wind_deg: number;
  effective_speed_m_min: number;
  created_at: string | null;
}

export interface FlightSessionsParams {
  limit?: number;
  offset?: number;
  drone_id?: number;
}

export async function getFlightSessions(params: FlightSessionsParams = {}): Promise<FlightSessionItem[]> {
  const data = await apiFetch<FlightSessionItem[]>("/api/flight-sessions", {
    params: { limit: params.limit, offset: params.offset, drone_id: params.drone_id },
  });
  return Array.isArray(data) ? data : [];
}

export async function getSessionTelemetry(
  sessionId: number,
  params: { limit?: number; offset?: number } = {}
): Promise<TelemetryRecord[]> {
  const data = await apiFetch<TelemetryRecord[]>(`/api/flight-sessions/${sessionId}/telemetry`, {
    params: { limit: params.limit, offset: params.offset },
  });
  return Array.isArray(data) ? data : [];
}
