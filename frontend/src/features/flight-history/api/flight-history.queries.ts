import { useCallback } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { retryWhileFailing } from "@/lib/query";
import type { FlightPathPoint } from "@/types/telemetry";
import { getFlightSessions, getSessionTelemetry, type FlightSessionItem } from "./flight-history.api";

const SESSIONS_STALE_MS = 30_000;
const PATH_POINT_LIMIT = 2000;

export const flightSessionsQueryOptions = (params: { limit?: number } = {}) =>
  queryOptions({
    queryKey: queryKeys.flightSessions.list(params),
    queryFn: () => getFlightSessions(params),
    staleTime: SESSIONS_STALE_MS,
    refetchInterval: retryWhileFailing,
  });

export function useFlightSessions(params: { limit?: number } = {}) {
  const { data, isLoading, isFetching, error, refetch } = useQuery(flightSessionsQueryOptions(params));
  return {
    sessions: data ?? [],
    loading: isLoading,
    refetching: isFetching,
    loadError: error,
    refetch,
  };
}

/**
 * Loads a flight's path on demand. A finished flight never changes, so its
 * path is cached for good and selecting it again doesn't refetch. A flight
 * still in progress is always refetched.
 */
export function useLoadFlightPath() {
  const queryClient = useQueryClient();
  return useCallback(
    (session: Pick<FlightSessionItem, "id" | "end_time">): Promise<FlightPathPoint[]> =>
      queryClient.fetchQuery({
        queryKey: queryKeys.flightSessions.path(session.id),
        queryFn: async () => {
          const rows = await getSessionTelemetry(session.id, { limit: PATH_POINT_LIMIT });
          return rows.map((p) => ({ lat: p.lat, lng: p.lng }));
        },
        staleTime: session.end_time ? Infinity : 0,
      }),
    [queryClient]
  );
}
