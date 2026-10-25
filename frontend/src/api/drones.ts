import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { queryKeys } from "./queryKeys";
import { retryWhileFailing } from "@/lib/query";

/*
 * Drones are read by several features (fleet, missions, the map), so the
 * read side lives here in the shared API layer. Writes are only done by the
 * fleet feature and live in features/fleet/api.
 */

export interface DroneResponse {
  id: number;
  name: string;
  base_speed_m_min: number;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
}

export async function fetchDrones(): Promise<DroneResponse[]> {
  const data = await apiFetch<DroneResponse[]>("/api/drones");
  return Array.isArray(data) ? data : [];
}

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
