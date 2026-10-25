import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { useInvalidateDrones } from "./useInvalidateDrones";

export async function deleteDrone(id: number): Promise<void> {
  await apiFetch(`/api/drones/${id}`, { method: "DELETE" });
}

export function useDeleteDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({ mutationFn: deleteDrone, onSuccess: invalidateDrones });
}
