import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { queryKeys } from "@/api/query-keys";
import { errorMessage } from "@/lib/error-message";
import type { TaskCreateBody } from "@/types/task";
import {
  cancelTask,
  createTask,
  deleteTask,
  getTask,
  getTaskReport,
  pauseTask,
  resumeTask,
  startTask,
  type TaskReportResponse,
} from "./missions.api";

const REPORT_POLL_MS = 3000;
const NO_REPORT_YET = "No report yet";

export function useTask(taskId: number, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => getTask(taskId),
    enabled: enabled && taskId > 0,
  });
}

export function useTaskReport(taskId: number) {
  return useQuery({
    queryKey: queryKeys.tasks.report(taskId),
    queryFn: () => getTaskReport(taskId),
    // The report is generated after the mission ends; poll until it's ready.
    refetchInterval: (query) =>
      (query.state.data as TaskReportResponse | undefined)?.status === "pending" ? REPORT_POLL_MS : false,
    retry: (failureCount, err) => {
      if (isNoReportYet(err)) return false;
      return failureCount < 2;
    },
  });
}

export function isNoReportYet(error: unknown): boolean {
  return error instanceof Error && error.message === NO_REPORT_YET;
}

type ActionKey = "create" | "start" | "pause" | "resume" | "cancel" | "delete";

/**
 * Mission actions. Each refreshes the mission list on success and shows a
 * toast on failure. The returned functions resolve to the result (or
 * true/false) instead of throwing, since the UI only needs to know whether
 * to close a dialog or clear a busy state.
 */
export function useMissionActions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const options = (action: ActionKey) => ({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    onError: (error: unknown) => {
      toast.error(t(`errors.task.${action}`), { description: errorMessage(error, t) });
    },
  });

  const create = useMutation({ mutationFn: (body: TaskCreateBody) => createTask(body), ...options("create") });
  const start = useMutation({ mutationFn: (id: number) => startTask(id), ...options("start") });
  const pause = useMutation({ mutationFn: (id: number) => pauseTask(id), ...options("pause") });
  const resume = useMutation({ mutationFn: (id: number) => resumeTask(id), ...options("resume") });
  const cancel = useMutation({ mutationFn: (id: number) => cancelTask(id), ...options("cancel") });
  const remove = useMutation({ mutationFn: (id: number) => deleteTask(id), ...options("delete") });

  const succeeded = (run: () => Promise<unknown>) =>
    run().then(
      () => true,
      () => false
    );

  return {
    createTask: (body: TaskCreateBody) => create.mutateAsync(body).catch(() => null),
    startTask: (id: number) => succeeded(() => start.mutateAsync(id)),
    pauseTask: (id: number) => succeeded(() => pause.mutateAsync(id)),
    resumeTask: (id: number) => succeeded(() => resume.mutateAsync(id)),
    cancelTask: (id: number) => succeeded(() => cancel.mutateAsync(id)),
    deleteTask: (id: number) => succeeded(() => remove.mutateAsync(id)),
  };
}
