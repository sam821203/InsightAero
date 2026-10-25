import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFlightSessions, fetchSessionTelemetry, type FlightSessionItem } from "@/api/flightSessions";
import { queryKeys } from "@/api/queryKeys";
import { retryWhileFailing } from "@/lib/query";
import type { FlightPathPoint } from "@/types/telemetry";

const SESSIONS_STALE_MS = 30_000;
const PATH_POINT_LIMIT = 2000;

export function useFlightSessions(params: { limit?: number } = {}) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.flightSessions.list(params),
    queryFn: () => fetchFlightSessions(params),
    staleTime: SESSIONS_STALE_MS,
    refetchInterval: retryWhileFailing,
  });
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
export function useLoadSessionPath() {
  const queryClient = useQueryClient();
  return useCallback(
    (session: Pick<FlightSessionItem, "id" | "end_time">): Promise<FlightPathPoint[]> =>
      queryClient.fetchQuery({
        queryKey: queryKeys.flightSessions.path(session.id),
        queryFn: async () => {
          const rows = await fetchSessionTelemetry(session.id, { limit: PATH_POINT_LIMIT });
          return rows.map((p) => ({ lat: p.lat, lng: p.lng }));
        },
        staleTime: session.end_time ? Infinity : 0,
      }),
    [queryClient]
  );
}
