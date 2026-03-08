import { apiFetch } from "./client";
import type { TaskItem, TaskCreateBody } from "@/types/task";

export interface TaskReportResponse {
  status: "pending" | "completed" | "failed";
  report_text: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const TASKS_BASE = "/api/tasks";

export async function fetchTask(taskId: number): Promise<TaskItem> {
  return apiFetch<TaskItem>(`${TASKS_BASE}/${taskId}`);
}

export async function fetchTaskReport(
  taskId: number
): Promise<TaskReportResponse> {
  return apiFetch<TaskReportResponse>(`${TASKS_BASE}/${taskId}/report`);
}

export async function fetchTasks(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<TaskItem[]> {
  const searchParams: Record<string, string | number | undefined> = {};
  if (params?.status) searchParams.status = params.status;
  if (params?.limit != null) searchParams.limit = params.limit;
  if (params?.offset != null) searchParams.offset = params.offset;
  const data = await apiFetch<TaskItem[]>(TASKS_BASE, { params: searchParams });
  return Array.isArray(data) ? data : [];
}

export async function createTask(body: TaskCreateBody): Promise<TaskItem> {
  return apiFetch<TaskItem>(TASKS_BASE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function startTask(taskId: number): Promise<void> {
  await apiFetch(`${TASKS_BASE}/${taskId}/start`, { method: "POST" });
}

export async function pauseTask(taskId: number): Promise<void> {
  await apiFetch(`${TASKS_BASE}/${taskId}/pause`, { method: "POST" });
}

export async function resumeTask(taskId: number): Promise<void> {
  await apiFetch(`${TASKS_BASE}/${taskId}/resume`, { method: "POST" });
}

export async function cancelTask(taskId: number): Promise<void> {
  await apiFetch(`${TASKS_BASE}/${taskId}/cancel`, { method: "POST" });
}

export async function deleteTask(taskId: number): Promise<void> {
  await apiFetch(`${TASKS_BASE}/${taskId}`, { method: "DELETE" });
}
