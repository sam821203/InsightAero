import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { DroneResponse } from "@/api/drones";
import { useInvalidateDrones } from "./useInvalidateDrones";

export interface DroneUpdateBody {
  name?: string;
  base_speed_m_min?: number;
}

export function updateDrone({ id, body }: { id: number; body: DroneUpdateBody }): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`/api/drones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function useUpdateDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({ mutationFn: updateDrone, onSuccess: invalidateDrones });
}
