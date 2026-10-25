import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { DroneResponse } from "@/api/drones";
import { useInvalidateDrones } from "./useInvalidateDrones";

export interface DroneCreateBody {
  name: string;
  base_speed_m_min?: number;
}

export function createDrone(body: DroneCreateBody): Promise<DroneResponse> {
  return apiFetch<DroneResponse>("/api/drones", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function useCreateDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({ mutationFn: createDrone, onSuccess: invalidateDrones });
}
