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
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  fetchDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  type DroneResponse,
} from "@/api/drones";
import type { ApiError } from "@/api/client";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";

interface MyDronesListProps {
  /** 當此值變動時會重新取得無人機列表（例如任務開始/取消/完成後，管理區塊的「待命/飛行中」會同步） */
  refreshTrigger?: string;
}

export default function MyDronesList({ refreshTrigger }: MyDronesListProps) {
  const [drones, setDrones] = useState<DroneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSpeed, setEditSpeed] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDrones = () => {
    fetchDrones()
      .then(setDrones)
      .catch(() => {})
      .finally(() => setLoading(false));
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
      .catch(() => {})
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
          setDeleteError(err.detail ?? "此無人機已有任務或飛行紀錄，無法刪除");
        } else {
          setDeleteError("刪除失敗");
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
      .catch(() => {})
      .finally(() => setAdding(false));
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>管理無人機</PanelTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3 w-3" />
          新增
        </Button>
      </PanelHeader>
      {showAddForm && (
        <div className="flex gap-2 border-b border-border-subtle p-2">
          <Input
            size="sm"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="無人機名稱"
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
            {adding ? "…" : "送出"}
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
            取消
          </Button>
        </div>
      )}
      <ScrollArea className="h-[180px]">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">載入中…</div>
        ) : drones.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">
            尚無無人機，請點「新增」建立
          </div>
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
                      placeholder="名稱"
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
                      placeholder="速度"
                      className="w-16 tabular-nums"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={savingEdit || !editName.trim() || parseFloat(editSpeed) <= 0}
                      onClick={handleSaveEdit}
                    >
                      {savingEdit ? "…" : "送出"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={savingEdit}
                      onClick={cancelEdit}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className={
                        d.status === "flying" ? "text-success-text flex-1 min-w-0 truncate" : "flex-1 min-w-0 truncate"
                      }
                    >
                      {d.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {d.status === "flying" ? "飛行中" : "待命"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(d)}
                      title="編輯"
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
                      title={d.status === "flying" ? "飛行中無法刪除" : "刪除"}
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
            <AlertDialogTitle>刪除無人機</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此無人機嗎？若已有任務或飛行紀錄則無法刪除。
              {deleteError != null && (
                <span className="mt-2 block text-destructive-text">{deleteError}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteConfirm}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "…" : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
