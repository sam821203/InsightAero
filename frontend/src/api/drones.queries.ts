import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchDrones, type DroneResponse } from "./drones.api";
import { queryKeys } from "./queryKeys";
import { retryWhileFailing } from "@/lib/query";

/*
 * Drone data changes only when we change it (fleet mutations) or when a
 * mission changes a drone's status (useTasks invalidates then). Between
 * those, cached data is good, so new subscribers reuse it.
 */
const DRONES_STALE_MS = 30_000;
const EMPTY: DroneResponse[] = [];

export const dronesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.drones.all,
    queryFn: fetchDrones,
    staleTime: DRONES_STALE_MS,
    refetchInterval: retryWhileFailing,
  });

export function useDrones() {
  const { data, isLoading, isFetching, error, refetch } = useQuery(dronesQueryOptions());
  return {
    drones: data ?? EMPTY,
    loading: isLoading,
    refetching: isFetching,
    loadError: error,
    refetch,
  };
}
