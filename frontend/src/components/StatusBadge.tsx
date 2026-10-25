import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AssignmentStatus, TaskStatus } from "@/types/task";

interface Appearance {
  tone: BadgeTone;
  dot?: boolean | "pulse";
}

/*
 * One place that decides how each status looks. Tones follow the token rules:
 * info = in progress, warning = needs attention, success = done,
 * danger = failed, neutral = not started or stopped on purpose.
 */
const TASK: Record<TaskStatus, Appearance> = {
  pending: { tone: "neutral" },
  starting: { tone: "info", dot: "pulse" },
  running: { tone: "info", dot: "pulse" },
  paused: { tone: "warning", dot: true },
  completed: { tone: "success" },
  cancelled: { tone: "neutral" },
  failed: { tone: "danger" },
};

const ASSIGNMENT: Record<AssignmentStatus, Appearance> = {
  pending: { tone: "neutral" },
  starting: { tone: "info", dot: "pulse" },
  flying: { tone: "info", dot: "pulse" },
  paused: { tone: "warning", dot: true },
  arrived: { tone: "success" },
  cancelled: { tone: "neutral" },
};

const DRONE: Record<"flying" | "idle", Appearance> = {
  flying: { tone: "info", dot: "pulse" },
  idle: { tone: "neutral" },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const { t } = useTranslation();
  const look = TASK[status] ?? TASK.pending;
  return (
    <Badge tone={look.tone} dot={look.dot} className={className}>
      {t(`status.task.${status}`)}
    </Badge>
  );
}

export function AssignmentStatusBadge({ status, className }: { status: AssignmentStatus; className?: string }) {
  const { t } = useTranslation();
  const look = ASSIGNMENT[status] ?? ASSIGNMENT.pending;
  return (
    <Badge tone={look.tone} dot={look.dot} className={className}>
      {t(`status.assignment.${status}`)}
    </Badge>
  );
}

export function DroneStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  const key = status === "flying" ? "flying" : "idle";
  const look = DRONE[key];
  return (
    <Badge tone={look.tone} dot={look.dot} className={className}>
      {t(`status.drone.${key}`)}
    </Badge>
  );
}
