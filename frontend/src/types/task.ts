/** Task status from backend */
export type TaskStatus =
  | "pending"
  | "starting"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

/** Assignment status from backend */
export type AssignmentStatus =
  | "pending"
  | "starting"
  | "flying"
  | "paused"
  | "arrived"
  | "cancelled";

export interface TaskAssignmentItem {
  id: number;
  task_id: number;
  drone_id: number;
  drone_name?: string;
  start_lat: number;
  start_lng: number;
  dest_lat: number;
  dest_lng: number;
  status: AssignmentStatus;
  flight_session_id: number | null;
}

export interface TaskItem {
  id: number;
  name: string | null;
  status: TaskStatus;
  created_at: string | null;
  updated_at: string | null;
  assignments: TaskAssignmentItem[];
}

export interface TaskCreateAssignmentInput {
  drone_id: number;
  start_lat: number;
  start_lng: number;
  dest_lat: number;
  dest_lng: number;
}

export interface TaskCreateBody {
  name?: string;
  assignments: TaskCreateAssignmentInput[];
}
