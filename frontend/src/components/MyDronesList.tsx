import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Plane } from "lucide-react";
import { toast } from "sonner";
import {
  fetchDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  type DroneResponse,
} from "@/api/drones";
import type { ApiError } from "@/api/client";
import { PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { DroneStatusBadge } from "@/components/StatusBadge";
import { ListEmpty, ListError, ListLoading } from "@/components/ListState";
import { errorMessage } from "@/lib/errorMessage";

/* Store the key, not translated text, so the message follows a language switch. */
type DeleteError = { key: "deleteBlocked" | "deleteFailed" } | { message: string };

interface MyDronesListProps {
  /** 當此值變動時會重新取得無人機列表（例如任務開始/取消/完成後，管理區塊的「待命/飛行中」會同步） */
  refreshTrigger?: string;
  className?: string;
}

export default function MyDronesList({ refreshTrigger, className }: MyDronesListProps) {
  const { t } = useTranslation();
  const [drones, setDrones] = useState<DroneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSpeed, setEditSpeed] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteError | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDrones = () => {
    setLoading(true);
    fetchDrones()
      .then((data) => {
        setDrones(data);
        setLoadError(null);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  };

  const notifyFailure = (titleKey: "addFailed" | "saveFailed") => (error: unknown) => {
    toast.error(t(`drones.${titleKey}`), { description: errorMessage(error, t) });
  };

  useEffect(() => {
    loadDrones();
  }, []);

  useEffect(() => {
    if (refreshTrigger != null) loadDrones();
  }, [refreshTrigger]);

  const startEdit = (d: DroneResponse) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditSpeed(String(d.base_speed_m_min));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditSpeed("");
  };

  const handleSaveEdit = () => {
    if (editingId == null) return;
    const name = editName.trim();
    const speed = parseFloat(editSpeed);
    if (!name || name.length > 128) return;
    if (Number.isNaN(speed) || speed <= 0) return;
    setSavingEdit(true);
    updateDrone(editingId, { name, base_speed_m_min: speed })
      .then(() => {
        cancelEdit();
        loadDrones();
      })
      .catch(notifyFailure("saveFailed"))
      .finally(() => setSavingEdit(false));
  };

  const openDeleteConfirm = (id: number) => {
    setDeleteConfirmId(id);
    setDeleteError(null);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmId(null);
    setDeleteError(null);
  };

  const handleDelete = () => {
    if (deleteConfirmId == null) return;
    setDeleting(true);
    setDeleteError(null);
    deleteDrone(deleteConfirmId)
      .then(() => {
        closeDeleteConfirm();
        loadDrones();
      })
      .catch((e) => {
        const err = e as ApiError;
        if (err.status === 409) {
          setDeleteError(err.detail ? { message: err.detail } : { key: "deleteBlocked" });
        } else {
          setDeleteError({ key: "deleteFailed" });
        }
      })
      .finally(() => setDeleting(false));
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    createDrone({ name })
      .then(() => {
        setNewName("");
        setShowAddForm(false);
        loadDrones();
      })
      .catch(notifyFailure("addFailed"))
      .finally(() => setAdding(false));
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <PanelHeader>
        <span className="text-xs text-muted-foreground">
          {drones.length > 0 || (!loading && loadError == null) ? t("drones.count", { count: drones.length }) : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3 w-3" />
          {t("common.add")}
        </Button>
      </PanelHeader>
      {showAddForm && (
        <div className="flex gap-2 border-b border-border-subtle p-2">
          <Input
            size="sm"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("drones.namePlaceholder")}
            className="flex-1"
            maxLength={128}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={adding || !newName.trim()}
            onClick={handleAdd}
          >
            {adding ? "…" : t("common.add")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setShowAddForm(false);
              setNewName("");
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {drones.length === 0 && loading ? (
          <ListLoading />
        ) : drones.length === 0 && loadError != null ? (
          <ListError title={t("drones.loadFailed")} error={loadError} onRetry={loadDrones} retrying={loading} />
        ) : drones.length === 0 ? (
          <ListEmpty
            icon={<Plane aria-hidden />}
            title={t("drones.empty")}
            description={t("drones.emptyHint")}
            action={
              !showAddForm && (
                <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t("drones.addDrone")}
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-0.5 p-2">
            {drones.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
              >
                {editingId === d.id ? (
                  <>
                    <Input
                      size="sm"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t("drones.nameShort")}
                      className="min-w-0 flex-1"
                      maxLength={128}
                    />
                    <Input
                      size="sm"
                      type="number"
                      min={1}
                      step={10}
                      value={editSpeed}
                      onChange={(e) => setEditSpeed(e.target.value)}
                      placeholder={t("drones.speedPlaceholder")}
                      className="w-16 tabular-nums"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={savingEdit || !editName.trim() || parseFloat(editSpeed) <= 0}
                      onClick={handleSaveEdit}
                    >
                      {savingEdit ? "…" : t("common.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={savingEdit}
                      onClick={cancelEdit}
                    >
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                    <DroneStatusBadge status={d.status} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(d)}
                      title={t("common.edit")}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-destructive-subtle hover:text-destructive-text"
                      disabled={d.status === "flying"}
                      onClick={() => openDeleteConfirm(d.id)}
                      title={d.status === "flying" ? t("drones.cannotDeleteFlying") : t("common.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <AlertDialog
        open={deleteConfirmId != null}
        onOpenChange={(open) => {
          if (!open) closeDeleteConfirm();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("drones.deleteDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("drones.deleteDialogDescription")}
              {deleteError != null && (
                <span className="mt-2 block text-destructive-text">
                  {"key" in deleteError ? t(`drones.${deleteError.key}`) : deleteError.message}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteConfirm}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "…" : t("drones.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
