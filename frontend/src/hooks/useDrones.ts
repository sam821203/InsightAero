import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDrones, type DroneResponse } from "@/api/drones";

const DRONES_QUERY_KEY = ["drones"] as const;

export function useDrones(refetchTrigger?: string) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: [...DRONES_QUERY_KEY, refetchTrigger ?? ""],
    queryFn: fetchDrones,
  });
  const drones: DroneResponse[] = data ?? [];
  const invalidateDrones = () =>
    queryClient.invalidateQueries({ queryKey: DRONES_QUERY_KEY });
  return {
    drones,
    loading: isLoading,
    refetchDrones: refetch,
    invalidateDrones,
  };
}
