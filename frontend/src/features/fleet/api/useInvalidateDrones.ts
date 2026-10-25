import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";

/** Every fleet write refreshes the shared drone list (map, mission form, fleet tab). */
export function useInvalidateDrones() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.drones.all });
}
