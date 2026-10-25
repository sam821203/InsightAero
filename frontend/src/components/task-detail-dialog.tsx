import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchTask, fetchTaskReport, type TaskReportResponse } from "@/hooks/use-tasks";
import { PanelTitle } from "@/components/ui/panel";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/error-message";
import { AssignmentStatusBadge, TaskStatusBadge } from "@/components/status-badge";

function ReportBlock({ taskId }: { taskId: number }) {
  const { t, i18n } = useTranslation();
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
        {t("taskDetail.report.none")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border border-destructive-border bg-destructive-subtle p-4 text-sm text-destructive-text">
        {t("taskDetail.report.loadFailed", { message: errorMessage(error, t) })}
      </div>
    );
  }

  if (isLoading || !report) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {t("taskDetail.report.loading")}
      </div>
    );
  }

  if (report.status === "pending") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {t("taskDetail.report.generating")}
      </div>
    );
  }

  if (report.status === "failed") {
    return (
      <div className="rounded-lg border border-border border-destructive-border bg-destructive-subtle p-4 text-sm">
        <p className="font-medium text-destructive-text">{t("taskDetail.report.failed")}</p>
        {report.error_message && (
          <p className="mt-1 text-muted-foreground">{report.error_message}</p>
        )}
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          {t("taskDetail.report.reload")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <PanelTitle className="mb-2">{t("taskDetail.report.title")}</PanelTitle>
      <div className="whitespace-pre-wrap text-sm text-foreground">
        {report.report_text ?? "—"}
      </div>
      {report.updated_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("taskDetail.report.updatedAt", { date: formatDateTime(report.updated_at, i18n.language) })}
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
  const { t, i18n } = useTranslation();
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
    task != null ? task.name || t("tasks.untitled", { id: task.id }) : t("taskDetail.fallbackTitle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4 pr-4">
            {!enabled && (
              <p className="text-sm text-muted-foreground">{t("taskDetail.noSelection")}</p>
            )}
            {enabled && error && (
              <p role="alert" className="text-sm text-destructive-text">
                {errorMessage(error, t)}
              </p>
            )}
            {enabled && isLoading && (
              <p className="text-sm text-muted-foreground">{t("taskDetail.loading")}</p>
            )}
            {enabled && task != null && (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <TaskStatusBadge status={task.status} />
                  {task.created_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("taskDetail.createdAt", { date: formatDateTime(task.created_at, i18n.language) })}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <PanelTitle as="h2">{t("taskDetail.assignments")}</PanelTitle>
                  <ul className="mt-2 space-y-2">
                    {task.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                      >
                        <span className="font-medium">
                          {a.drone_name ?? t("common.droneFallback", { id: a.drone_id })}
                        </span>
                        <AssignmentStatusBadge status={a.status} />
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
