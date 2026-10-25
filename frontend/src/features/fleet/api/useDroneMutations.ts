import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { createDrone, deleteDrone, updateDrone, type DroneCreateBody, type DroneUpdateBody } from "./drones";

/** Every fleet write refreshes the shared drone list (map, mission form, fleet tab). */
function useInvalidateDrones() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.drones.all });
}

export function useCreateDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({
    mutationFn: (body: DroneCreateBody) => createDrone(body),
    onSuccess: invalidateDrones,
  });
}

export function useUpdateDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DroneUpdateBody }) => updateDrone(id, body),
    onSuccess: invalidateDrones,
  });
}

export function useDeleteDrone() {
  const invalidateDrones = useInvalidateDrones();
  return useMutation({
    mutationFn: (id: number) => deleteDrone(id),
    onSuccess: invalidateDrones,
  });
}
