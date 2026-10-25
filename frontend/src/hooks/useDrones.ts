import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDrone,
  deleteDrone,
  fetchDrones,
  updateDrone,
  type DroneCreateBody,
  type DroneResponse,
  type DroneUpdateBody,
} from "@/api/drones";
import { queryKeys } from "@/api/queryKeys";
import { retryWhileFailing } from "@/lib/query";

/*
 * Drone data changes only when we change it (mutations below) or when a
 * mission changes a drone's status (useTasks invalidates then). Between those,
 * cached data is good, so new subscribers (e.g. opening the create-mission
 * dialog) reuse it instead of refetching.
 */
const DRONES_STALE_MS = 30_000;
const EMPTY: DroneResponse[] = [];

export function useDrones() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.drones.all,
    queryFn: fetchDrones,
    staleTime: DRONES_STALE_MS,
    refetchInterval: retryWhileFailing,
  });
  return {
    drones: data ?? EMPTY,
    loading: isLoading,
    refetching: isFetching,
    loadError: error,
    refetch,
  };
}

export function useDroneMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: queryKeys.drones.all });

  const create = useMutation({
    mutationFn: (body: DroneCreateBody) => createDrone(body),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: DroneUpdateBody }) => updateDrone(id, body),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteDrone(id),
    onSuccess,
  });

  return { create, update, remove };
}
