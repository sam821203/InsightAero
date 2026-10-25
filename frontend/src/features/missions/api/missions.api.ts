import { apiFetch } from "@/api/client";
import type { TaskCreateBody, TaskItem } from "@/types/task";

export interface TaskReportResponse {
  status: "pending" | "completed" | "failed";
  report_text: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const TASKS_BASE = "/api/tasks";

export function getTask(taskId: number): Promise<TaskItem> {
  return apiFetch<TaskItem>(`${TASKS_BASE}/${taskId}`);
}

export function getTaskReport(taskId: number): Promise<TaskReportResponse> {
  return apiFetch<TaskReportResponse>(`${TASKS_BASE}/${taskId}/report`);
}

/** The backend answers the report request with this detail until the report exists. */
const NO_REPORT_YET = "No report yet";

export function isNoReportYet(error: unknown): boolean {
  return error instanceof Error && error.message === NO_REPORT_YET;
}

export function createTask(body: TaskCreateBody): Promise<TaskItem> {
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
