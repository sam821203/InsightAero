import { apiFetch } from "./client";

export interface DroneResponse {
  id: number;
  name: string;
  base_speed_m_min: number;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
}

export interface DroneCreateBody {
  name: string;
  base_speed_m_min?: number;
}

export interface DroneUpdateBody {
  name?: string;
  base_speed_m_min?: number;
}

export async function fetchDrones(): Promise<DroneResponse[]> {
  const data = await apiFetch<DroneResponse[]>("/api/drones");
  return Array.isArray(data) ? data : [];
}

export async function createDrone(body: DroneCreateBody): Promise<DroneResponse> {
  return apiFetch<DroneResponse>("/api/drones", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateDrone(
  droneId: number,
  body: DroneUpdateBody
): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`/api/drones/${droneId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteDrone(droneId: number): Promise<void> {
  await apiFetch(`/api/drones/${droneId}`, { method: "DELETE" });
}
