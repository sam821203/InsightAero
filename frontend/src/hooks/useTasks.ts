import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskItem, TaskCreateBody } from "@/types/task";
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

const TASKS_QUERY_KEY = ["tasks"] as const;

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
  const [mutationError, setMutationError] = useState<Error | null>(null);

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
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => apiFetchTasks(params),
    refetchInterval: (query) => {
      const tasks = (query.state.data ?? []) as TaskItem[];
      const hasRunningOrStarting = tasks.some(
        (t) => t.status === "running" || t.status === "starting"
      );
      return hasRunningOrStarting ? 5000 : false;
    },
  });

  const invalidateTasks = () => {
    setMutationError(null);
    return queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
  };

  const createMutation = useMutation({
    mutationFn: apiCreateTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
  });

  const startMutation = useMutation({
    mutationFn: apiStartTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
  });

  const pauseMutation = useMutation({
    mutationFn: apiPauseTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
  });

  const resumeMutation = useMutation({
    mutationFn: apiResumeTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
  });

  const cancelMutation = useMutation({
    mutationFn: apiCancelTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteTask,
    onSuccess: invalidateTasks,
    onError: (e) =>
      setMutationError(e instanceof Error ? e : new Error(String(e))),
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

  const error =
    mutationError ??
    (queryError instanceof Error
      ? queryError
      : queryError
        ? new Error(String(queryError))
        : null);

  return {
    fetchTask,
    fetchTaskReport,
    tasks: data ?? [],
    loading: isLoading,
    error,
    fetchTasks: refetch,
    createTask,
    startTask,
    pauseTask,
    resumeTask,
    cancelTask,
    deleteTask,
  };
}
