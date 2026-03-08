import { apiFetch } from "./client";

export interface SimulationStartBody {
  drone_count?: number;
  drone_ids?: number[];
  start_lat?: number;
  start_lng?: number;
  dest_lat?: number;
  dest_lng?: number;
}

export interface SimulationStartResponse {
  status: string;
  session_ids: number[];
  drone_ids: number[];
}

export async function simulationStart(
  body?: SimulationStartBody
): Promise<SimulationStartResponse> {
  return apiFetch<SimulationStartResponse>("/api/simulation/start", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function simulationStop(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/simulation/stop", {
    method: "POST",
  });
}

export async function simulationPause(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/simulation/pause", {
    method: "POST",
  });
}

export async function simulationResume(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/simulation/resume", {
    method: "POST",
  });
}
