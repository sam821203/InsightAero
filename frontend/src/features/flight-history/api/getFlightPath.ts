import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { FlightPathPoint } from "@/types/telemetry";
import type { FlightSessionItem } from "./getFlightSessions";

export interface TelemetryRecord {
  id: number;
  session_id: number | null;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  heading: number;
  battery: number;
  wind_speed: number;
  wind_deg: number;
  effective_speed_m_min: number;
  created_at: string | null;
}

const PATH_POINT_LIMIT = 2000;

export async function getSessionTelemetry(
  sessionId: number,
  params: { limit?: number; offset?: number } = {}
): Promise<TelemetryRecord[]> {
  const data = await apiFetch<TelemetryRecord[]>(`/api/flight-sessions/${sessionId}/telemetry`, {
    params: { limit: params.limit, offset: params.offset },
  });
  return Array.isArray(data) ? data : [];
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
