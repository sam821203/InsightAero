import { apiFetch } from "./client";

/*
 * Drones are read by several features (fleet, missions, the map), so the
 * read request lives in the shared API layer. Writes are only done by the
 * fleet feature and live in features/fleet/api.
 */

export interface DroneResponse {
  id: number;
  name: string;
  base_speed_m_min: number;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
}

export async function fetchDrones(): Promise<DroneResponse[]> {
  const data = await apiFetch<DroneResponse[]>("/api/drones");
  return Array.isArray(data) ? data : [];
}
