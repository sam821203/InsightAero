import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Rocket, Square, Pause, Play, Trash2, ClipboardList, Plus } from "lucide-react";
import type { TaskItem } from "@/types/task";
import { cn } from "@/lib/utils";
import { AssignmentStatusBadge, TaskStatusBadge } from "@/components/StatusBadge";
import { ListEmpty, ListError, ListLoading } from "@/components/ListState";
import { useTranslation } from "react-i18next";

interface TaskListProps {
  tasks: TaskItem[];
  onStart: (taskId: number) => void;
  onPause: (taskId: number) => void;
  onResume: (taskId: number) => void;
  onCancel: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onTaskClick?: (taskId: number) => void;
  /** First load in progress (no data yet). */
  loading?: boolean;
  /** The list failed to load. */
  loadError?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  /** Shown as the empty state's action. */
  onCreate?: () => void;
  className?: string;
}

export default function TaskList({
  tasks,
  onStart,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onTaskClick,
  loading,
  loadError,
  onRetry,
  retrying,
  onCreate,
  className,
}: TaskListProps) {
  const { t } = useTranslation();
  const [actingId, setActingId] = useState<number | null>(null);

  const handleStart = async (taskId: number) => {
    setActingId(taskId);
    try {
      await onStart(taskId);
    } finally {
      setActingId(null);
    }
  };
  const handlePause = async (taskId: number) => {
    setActingId(taskId);
    try {
      await onPause(taskId);
    } finally {
      setActingId(null);
    }
  };
  const handleResume = async (taskId: number) => {
    setActingId(taskId);
    try {
      await onResume(taskId);
    } finally {
      setActingId(null);
    }
  };
  const handleCancel = async (taskId: number) => {
    setActingId(taskId);
    try {
      await onCancel(taskId);
    } finally {
      setActingId(null);
    }
  };
  const handleDelete = async (taskId: number) => {
    setActingId(taskId);
    try {
      await onDelete(taskId);
    } finally {
      setActingId(null);
    }
  };

  return (
    <ScrollArea className={cn("min-h-0", className)}>
        {tasks.length === 0 && loading ? (
          <ListLoading />
        ) : tasks.length === 0 && loadError ? (
          <ListError title={t("tasks.loadFailed")} error={loadError} onRetry={onRetry} retrying={retrying} />
        ) : tasks.length === 0 ? (
          <ListEmpty
            icon={<ClipboardList aria-hidden />}
            title={t("tasks.empty")}
            description={t("tasks.emptyHint")}
            action={
              onCreate && (
                <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={onCreate}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t("taskForm.title")}
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-2 p-2">
            {tasks.map((task) => {
              const canStart = task.status === "pending";
              const canPause = task.status === "running";
              const canResume = task.status === "paused";
              // 終止僅在任務已開始（啟動中 / 執行中 / 已暫停）時可點擊；待命中尚未開始則 disabled
              const canCancel =
                task.status === "pending" ||
                task.status === "running" ||
                task.status === "paused" ||
                task.status === "starting";
              const canCancelClick =
                task.status === "starting" ||
                task.status === "running" ||
                task.status === "paused";
              const busy = actingId === task.id;
              return (
                <li
                  key={task.id}
                  className="rounded-md border border-border-subtle bg-surface-sunken p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    {onTaskClick ? (
                      <button
                        type="button"
                        onClick={() => onTaskClick(task.id)}
                        className="font-medium text-foreground underline-offset-2 hover:underline text-left"
                      >
                        {task.name || t("tasks.untitled", { id: task.id })}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">
                        {task.name || t("tasks.untitled", { id: task.id })}
                      </span>
                    )}
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <ul className="mt-1.5 space-y-0.5 pl-1 text-muted-foreground">
                    {task.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{a.drone_name ?? t("common.droneFallback", { id: a.drone_id })}</span>
                        <AssignmentStatusBadge status={a.status} className="border-transparent bg-transparent px-0" />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {canStart && (
                      <Button
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => handleStart(task.id)}
                        disabled={busy}
                      >
                        <Rocket className="h-2.5 w-2.5" />
                        {t("tasks.start")}
                      </Button>
                    )}
                    {canPause && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => handlePause(task.id)}
                        disabled={busy}
                      >
                        <Pause className="h-2.5 w-2.5" />
                        {t("tasks.pause")}
                      </Button>
                    )}
                    {canResume && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => handleResume(task.id)}
                        disabled={busy}
                      >
                        <Play className="h-2.5 w-2.5" />
                        {t("tasks.resume")}
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => handleCancel(task.id)}
                        disabled={busy || !canCancelClick}
                        title={
                          !canCancelClick
                            ? t("tasks.cancelDisabled")
                            : t("tasks.cancelTitle")
                        }
                      >
                        <Square className="h-2.5 w-2.5" />
                        {t("tasks.cancel")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-destructive-subtle hover:text-destructive-text"
                      onClick={() => handleDelete(task.id)}
                      disabled={busy}
                      title={t("tasks.deleteTitle")}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </ScrollArea>
  );
}
