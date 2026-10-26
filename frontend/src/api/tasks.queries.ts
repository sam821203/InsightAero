import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchTasks } from "./tasks.api";
import { queryKeys } from "./query-keys";
import { retryWhileFailing } from "@/lib/query";
import { hasMissionInFlight } from "@/utils/task-status";
import type { TaskItem } from "@/types/task";

/* Everyone reads the same list, so every caller shares one cache entry and one poll. */
const TASK_LIST_PARAMS = { limit: 30 } as const;
const POLL_WHILE_FLYING_MS = 5000;
const EMPTY: TaskItem[] = [];

export const tasksQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.tasks.list(TASK_LIST_PARAMS),
    queryFn: () => fetchTasks(TASK_LIST_PARAMS),
    refetchInterval: (query) => {
      // Keep trying while the list can't load, so it recovers on its own when the backend is back.
      const retry = retryWhileFailing(query);
      if (retry) return retry;
      const tasks = query.state.data ?? EMPTY;
      const flying = tasks.some((t) => t.status === "running" || t.status === "starting");
      return flying ? POLL_WHILE_FLYING_MS : false;
    },
  });

export function useTasks() {
  const { data, isLoading, isFetching, error, refetch } = useQuery(tasksQueryOptions());
  return {
    tasks: data ?? EMPTY,
    /** True once the list has loaded at least once (stays true if a later refetch fails). */
    loaded: data != null,
    loading: isLoading,
    /** Set when the list failed to load. Action failures are shown as toasts instead. */
    loadError: error,
    refetching: isFetching,
    refetch,
  };
}

/**
 * Whether a mission is flying or paused, derived from the mission list.
 * Replaces the old `runState` that was copied into the telemetry store.
 */
export function useMissionInFlight(): boolean {
  // Read-only subscriber: the dashboard already keeps the list fresh (polling,
  // invalidation), so mounting this (e.g. opening the AI panel) shouldn't refetch.
  const { data } = useQuery({ ...tasksQueryOptions(), select: hasMissionInFlight, refetchOnMount: false });
  return data ?? false;
}
