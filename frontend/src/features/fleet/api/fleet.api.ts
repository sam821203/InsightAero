import { apiFetch } from "@/api/client";
import type { DroneResponse } from "@/api/drones.api";

export interface DroneCreateBody {
  name: string;
  base_speed_m_min?: number;
}

export interface DroneUpdateBody {
  name?: string;
  base_speed_m_min?: number;
}

export function createDrone(body: DroneCreateBody): Promise<DroneResponse> {
  return apiFetch<DroneResponse>("/api/drones", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateDrone(id: number, body: DroneUpdateBody): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`/api/drones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteDrone(id: number): Promise<void> {
  await apiFetch(`/api/drones/${id}`, { method: "DELETE" });
}
