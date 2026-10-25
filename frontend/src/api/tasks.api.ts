import { apiFetch } from "./client";
import type { TaskItem } from "@/types/task";

/*
 * The mission list is read by several parts of the app (the missions tab,
 * the map, the AI navigator), so the read request is shared. Mission actions
 * and details live in features/missions/api.
 */

export interface TaskListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTasks(params: TaskListParams = {}): Promise<TaskItem[]> {
  const data = await apiFetch<TaskItem[]>("/api/tasks", {
    params: { status: params.status, limit: params.limit, offset: params.offset },
  });
  return Array.isArray(data) ? data : [];
}
