import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Rocket, Square, Pause, Play, Trash2 } from "lucide-react";
import type { TaskItem, TaskStatus, AssignmentStatus } from "@/types/task";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "待命中",
  starting: "啟動中",
  running: "執行中",
  paused: "已暫停",
  completed: "已完成",
  cancelled: "已終止",
  failed: "失敗",
};

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending: "待命",
  starting: "啟動中",
  flying: "飛行中",
  paused: "已暫停",
  arrived: "已抵達",
  cancelled: "已終止",
};

interface TaskListProps {
  tasks: TaskItem[];
  onStart: (taskId: number) => void;
  onPause: (taskId: number) => void;
  onResume: (taskId: number) => void;
  onCancel: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onTaskClick?: (taskId: number) => void;
}

export default function TaskList({
  tasks,
  onStart,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onTaskClick,
}: TaskListProps) {
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
    <Panel>
      <PanelHeader>
        <PanelTitle>任務列表</PanelTitle>
      </PanelHeader>
      <ScrollArea className="h-[240px]">
        {tasks.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">尚無任務</div>
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
                        {task.name || `任務 #${task.id}`}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">
                        {task.name || `任務 #${task.id}`}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {TASK_STATUS_LABEL[task.status]}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 pl-1 text-muted-foreground">
                    {task.assignments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2">
                        <span>{a.drone_name ?? `無人機 ${a.drone_id}`}</span>
                        <span>
                          {ASSIGNMENT_STATUS_LABEL[a.status]}
                        </span>
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
                        開始
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
                        暫停
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
                        繼續
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
                            ? "任務尚未開始，無法終止"
                            : "終止任務"
                        }
                      >
                        <Square className="h-2.5 w-2.5" />
                        終止
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-destructive-subtle hover:text-destructive-text"
                      onClick={() => handleDelete(task.id)}
                      disabled={busy}
                      title="刪除任務"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      刪除
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </Panel>
  );
}
