import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/errorMessage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskItem, TaskCreateBody } from "@/types/task";
import { queryKeys } from "@/api/queryKeys";
import { retryWhileFailing } from "@/lib/query";
import {
  fetchTask as apiFetchTask,
  fetchTaskReport as apiFetchTaskReport,
  fetchTasks as apiFetchTasks,
  createTask as apiCreateTask,
  startTask as apiStartTask,
  pauseTask as apiPauseTask,
  resumeTask as apiResumeTask,
  cancelTask as apiCancelTask,
  deleteTask as apiDeleteTask,
  type TaskReportResponse,
} from "@/api/tasks";

export type { TaskReportResponse } from "@/api/tasks";

const TASKS_QUERY_KEY = queryKeys.tasks.all;

type ActionKey = "create" | "start" | "pause" | "resume" | "cancel" | "delete";

export async function fetchTask(taskId: number): Promise<TaskItem> {
  return apiFetchTask(taskId);
}

export async function fetchTaskReport(
  taskId: number
): Promise<TaskReportResponse> {
  return apiFetchTaskReport(taskId);
}

export function useTasks(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const queryKey = useMemo(
    () =>
      [
        ...TASKS_QUERY_KEY,
        {
          status: params?.status,
          limit: params?.limit,
          offset: params?.offset,
        },
      ] as const,
    [params?.status, params?.limit, params?.offset]
  );

  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => apiFetchTasks(params),
    refetchInterval: (query) => {
      // Keep trying while the list can't load, so it recovers on its own when the backend is back.
      const retry = retryWhileFailing(query);
      if (retry) return retry;
      const tasks = (query.state.data ?? []) as TaskItem[];
      const hasRunningOrStarting = tasks.some(
        (t) => t.status === "running" || t.status === "starting"
      );
      return hasRunningOrStarting ? 5000 : false;
    },
  });

  /*
   * Mission status drives drone status (flying / idle) and creates flight
   * records, so when any mission's status changes, drones and flight history
   * are refetched. This covers our own actions, the 5s polling and the
   * WebSocket "arrived" event, since all of them end in a new task list.
   */
  const statusSignature = useMemo(
    () => (data ?? []).map((task) => `${task.id}:${task.status}`).sort().join(","),
    [data]
  );
  const previousSignature = useRef<string | null>(null);
  useEffect(() => {
    if (data == null) return;
    const previous = previousSignature.current;
    previousSignature.current = statusSignature;
    if (previous == null || previous === statusSignature) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.drones.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.flightSessions.all });
  }, [data, statusSignature, queryClient]);

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });

  /* Every action failure gets a toast; before this they failed silently. */
  const notifyFailure = (action: ActionKey) => (error: unknown) => {
    toast.error(t(`errors.task.${action}`), { description: errorMessage(error, t) });
  };

  const createMutation = useMutation({
    mutationFn: apiCreateTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("create"),
  });

  const startMutation = useMutation({
    mutationFn: apiStartTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("start"),
  });

  const pauseMutation = useMutation({
    mutationFn: apiPauseTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("pause"),
  });

  const resumeMutation = useMutation({
    mutationFn: apiResumeTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("resume"),
  });

  const cancelMutation = useMutation({
    mutationFn: apiCancelTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("cancel"),
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteTask,
    onSuccess: invalidateTasks,
    onError: notifyFailure("delete"),
  });

  const createTask = async (body: TaskCreateBody): Promise<TaskItem | null> => {
    try {
      return await createMutation.mutateAsync(body);
    } catch {
      return null;
    }
  };

  const startTask = async (taskId: number): Promise<boolean> => {
    try {
      await startMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const pauseTask = async (taskId: number): Promise<boolean> => {
    try {
      await pauseMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const resumeTask = async (taskId: number): Promise<boolean> => {
    try {
      await resumeMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const cancelTask = async (taskId: number): Promise<boolean> => {
    try {
      await cancelMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const deleteTask = async (taskId: number): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  return {
    fetchTask,
    fetchTaskReport,
    tasks: data ?? [],
    loading: isLoading,
    /** Set when the list itself failed to load (action failures are shown as toasts). */
    loadError,
    refetching: isFetching,
    fetchTasks: refetch,
    createTask,
    startTask,
    pauseTask,
    resumeTask,
    cancelTask,
    deleteTask,
  };
}
