import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchTask, fetchTaskReport, type TaskReportResponse } from "@/hooks/useTasks";
import type { TaskStatus, AssignmentStatus } from "@/types/task";

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

function ReportBlock({ taskId }: { taskId: number }) {
  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["taskReport", taskId],
    queryFn: () => fetchTaskReport(taskId),
    refetchInterval: (query) => {
      const status = (query.state.data as TaskReportResponse | undefined)?.status;
      return status === "pending" ? 3000 : false;
    },
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === "No report yet") return false;
      return failureCount < 2;
    },
  });

  if (error && (error as Error).message === "No report yet") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        此任務尚無結案報告（可能尚未完成或報告未觸發）。
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-destructive/5 p-4 text-sm text-destructive">
        無法載入報告：{(error as Error).message}
      </div>
    );
  }

  if (isLoading || !report) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        載入報告中…
      </div>
    );
  }

  if (report.status === "pending") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        報告生成中…
      </div>
    );
  }

  if (report.status === "failed") {
    return (
      <div className="rounded-lg border border-border bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">報告產生失敗</p>
        {report.error_message && (
          <p className="mt-1 text-muted-foreground">{report.error_message}</p>
        )}
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          重新載入
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
        結案報告
      </h3>
      <div className="whitespace-pre-wrap text-sm text-foreground">
        {report.report_text ?? "—"}
      </div>
      {report.updated_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          更新於 {new Date(report.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number | null;
}

export default function TaskDetailDialog({
  open,
  onOpenChange,
  taskId,
}: TaskDetailDialogProps) {
  const id = taskId ?? 0;
  const enabled = open && id > 0;

  const {
    data: task,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id),
    enabled,
  });

  const title =
    task != null
      ? task.name || `任務 #${task.id}`
      : id > 0
        ? "任務詳情"
        : "任務詳情";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4 pr-4">
            {!enabled && (
              <p className="text-sm text-muted-foreground">未選擇任務</p>
            )}
            {enabled && error && (
              <p className="text-sm text-destructive">
                {(error as Error).message}
              </p>
            )}
            {enabled && isLoading && (
              <p className="text-sm text-muted-foreground">載入任務中…</p>
            )}
            {enabled && task != null && (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    狀態：{TASK_STATUS_LABEL[task.status as TaskStatus]}
                  </p>
                  {task.created_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      建立於 {new Date(task.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                    指派
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {task.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                      >
                        <span className="font-medium">
                          {a.drone_name ?? `無人機 ${a.drone_id}`}
                        </span>
                        <span className="text-muted-foreground">
                          {ASSIGNMENT_STATUS_LABEL[a.status as AssignmentStatus]}
                        </span>
                        <span className="text-muted-foreground">
                          ({a.start_lat.toFixed(4)}, {a.start_lng.toFixed(4)}) → (
                          {a.dest_lat.toFixed(4)}, {a.dest_lng.toFixed(4)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ReportBlock taskId={task.id} />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
