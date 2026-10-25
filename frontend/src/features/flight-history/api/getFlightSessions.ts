import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { retryWhileFailing } from "@/lib/query";

export interface FlightSessionItem {
  id: number;
  drone_id: number | null;
  drone_name: string | null;
  start_time: string | null;
  end_time: string | null;
  weather_snapshot: string | null;
}

export interface FlightSessionsParams {
  limit?: number;
  offset?: number;
  drone_id?: number;
}

export async function getFlightSessions(params: FlightSessionsParams = {}): Promise<FlightSessionItem[]> {
  const data = await apiFetch<FlightSessionItem[]>("/api/flight-sessions", {
    params: { limit: params.limit, offset: params.offset, drone_id: params.drone_id },
  });
  return Array.isArray(data) ? data : [];
}

const SESSIONS_STALE_MS = 30_000;

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
