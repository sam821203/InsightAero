import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";
import type { TaskItem } from "@/types/task";

/**
 * Mission status drives drone status (flying / idle) and creates flight
 * records, so when any mission's status changes, drones and flight history
 * are refetched. This covers our own actions, the 5s polling and the
 * WebSocket "arrived" event, since all of them end in a new mission list.
 *
 * Call it once, where the mission list is composed (the dashboard).
 */
export function useMissionStatusSync(tasks: TaskItem[], loaded: boolean) {
  const queryClient = useQueryClient();
  const signature = useMemo(
    () => tasks.map((task) => `${task.id}:${task.status}`).sort().join(","),
    [tasks]
  );
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const before = previous.current;
    previous.current = signature;
    if (before == null || before === signature) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.drones.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.flightSessions.all });
  }, [loaded, signature, queryClient]);
}
