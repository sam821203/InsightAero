import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/ui/panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskItem } from "@/types/task";
import { isActiveTask } from "@/utils/task-status";
import { useMissionActions } from "@/features/missions/api/missions.queries";
import TaskList from "./task-list";
import TaskCreateForm from "./task-create-form";
import TaskDetailDialog from "./task-detail-dialog";

interface MissionsPanelProps {
  tasks: TaskItem[];
  loading: boolean;
  loadError: unknown;
  refetching: boolean;
  onRetry: () => void;
  /** A mission was stopped or deleted; the caller clears what it drew for it (e.g. trails). */
  onMissionEnded?: () => void;
  className?: string;
}

/**
 * The missions tab: list, actions, and the create / detail dialogs.
 * Dialog state is local; nothing outside this panel needs it.
 */
export default function MissionsPanel({
  tasks,
  loading,
  loadError,
  refetching,
  onRetry,
  onMissionEnded,
  className,
}: MissionsPanelProps) {
  const { t } = useTranslation();
  const actions = useMissionActions();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [addressErrorOpen, setAddressErrorOpen] = useState(false);

  const activeTasks = useMemo(() => tasks.filter(isActiveTask), [tasks]);

  /** Drones already assigned to an unfinished mission can't be assigned again. */
  const busyDroneIds = useMemo(
    () => new Set(activeTasks.flatMap((task) => (task.assignments ?? []).map((a) => a.drone_id))),
    [activeTasks]
  );

  const endMission = (run: (id: number) => Promise<boolean>) => async (id: number) => {
    if (await run(id)) onMissionEnded?.();
  };

  const showCount = tasks.length > 0 || (!loading && !loadError);

  return (
    <div className={className}>
      <PanelHeader>
        <span className="text-xs text-muted-foreground">
          {showCount ? t("sidebar.activeCount", { count: activeTasks.length }) : null}
        </span>
        <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("taskForm.title")}
        </Button>
      </PanelHeader>
      <TaskList
        className="flex-1"
        tasks={tasks}
        onStart={actions.startTask}
        onPause={actions.pauseTask}
        onResume={actions.resumeTask}
        onCancel={endMission(actions.cancelTask)}
        onDelete={endMission(actions.deleteTask)}
        onTaskClick={setSelectedTaskId}
        loading={loading}
        loadError={loadError}
        onRetry={onRetry}
        retrying={refetching}
        onCreate={() => setCreateOpen(true)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("taskForm.title")}</DialogTitle>
            <DialogDescription>{t("taskForm.description")}</DialogDescription>
          </DialogHeader>
          <TaskCreateForm
            onCreate={actions.createTask}
            onSuccess={() => setCreateOpen(false)}
            onAddressError={() => setAddressErrorOpen(true)}
            excludeDroneIds={busyDroneIds}
          />
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        open={selectedTaskId != null}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        taskId={selectedTaskId}
      />

      <AlertDialog open={addressErrorOpen} onOpenChange={setAddressErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("addressError.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("addressError.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAddressErrorOpen(false)}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
