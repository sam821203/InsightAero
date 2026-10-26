import type { TaskItem, TaskStatus } from "@/types/task";

const ACTIVE_STATUSES: readonly TaskStatus[] = ["pending", "starting", "running", "paused"];

/** Not finished yet: waiting, starting, flying or paused. */
export function isActiveTask(task: TaskItem): boolean {
  return ACTIVE_STATUSES.includes(task.status);
}

/** A mission is flying or paused mid-flight (what the AI navigator calls "mission active"). */
export function hasMissionInFlight(tasks: TaskItem[]): boolean {
  return tasks.some((task) => task.status === "running" || task.status === "paused");
}
