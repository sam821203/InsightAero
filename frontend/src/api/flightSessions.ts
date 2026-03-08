import { apiFetch } from "./client";

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

export async function fetchFlightSessions(params?: {
  limit?: number;
  offset?: number;
  drone_id?: number;
}): Promise<FlightSessionItem[]> {
  const searchParams: Record<string, string | number | undefined> = {};
  if (params?.limit != null) searchParams.limit = params.limit;
  if (params?.offset != null) searchParams.offset = params.offset;
  if (params?.drone_id != null) searchParams.drone_id = params.drone_id;
  const data = await apiFetch<FlightSessionItem[]>("/api/flight-sessions", {
    params: searchParams,
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchSessionTelemetry(
  sessionId: number,
  params?: { limit?: number; offset?: number }
): Promise<TelemetryRecord[]> {
  const searchParams: Record<string, string | number | undefined> = {};
  if (params?.limit != null) searchParams.limit = params.limit;
  if (params?.offset != null) searchParams.offset = params.offset;
  const data = await apiFetch<TelemetryRecord[]>(
    `/api/flight-sessions/${sessionId}/telemetry`,
    { params: searchParams }
  );
  return Array.isArray(data) ? data : [];
}
