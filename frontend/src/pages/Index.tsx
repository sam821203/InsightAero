import { useState, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTelemetryConnection } from "@/hooks/useTelemetryConnection";
import { liveDroneIdsOf, useTelemetryStore } from "@/stores/telemetryStore";
import { useUserLocation, FALLBACK_CENTER } from "@/hooks/useUserLocation";
import { useTheme } from "@/contexts/useTheme";
import { useDrones } from "@/hooks/useDrones";
import { useUIStore } from "@/stores/uiStore";
import LiveMapView from "@/components/LiveMapView";
import TelemetryHUD from "@/components/TelemetryHUD";
import AIFloatingNavigator from "@/components/AIFloatingNavigator";
import FlightSessionsList from "@/components/FlightSessionsList";
import MyDronesList from "@/components/MyDronesList";
import TaskList from "@/components/TaskList";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import TaskCreateForm from "@/components/TaskCreateForm";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Satellite, Sun, Moon, Loader2, Plus } from "lucide-react";
import type { FlightPathPoint } from "@/types/telemetry";
import type { TaskItem } from "@/types/task";
import { useTasks } from "@/hooks/useTasks";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { isBackendUnreachable } from "@/api/client";

const ACTIVE_TASK_STATUSES = ["pending", "starting", "running", "paused"] as const;

function isActiveTask(task: TaskItem): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(task.status);
}

type SidebarTab = "missions" | "fleet" | "history";

export default function Index() {
  const { t } = useTranslation();
  const [historyPath, setHistoryPath] = useState<FlightPathPoint[] | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("missions");
  const [createOpen, setCreateOpen] = useState(false);
  const [lastEndPoint, setLastEndPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const {
    selectedTaskId,
    setSelectedTaskId,
    sidebarWidth,
    resizeSidebar,
    addressErrorOpen,
    setAddressErrorOpen,
    pageLoading,
    setPageLoading,
  } = useUIStore();

  const {
    tasks,
    loading: tasksLoading,
    loadError: tasksLoadError,
    refetching: tasksRefetching,
    fetchTasks,
    createTask,
    startTask,
    pauseTask,
    resumeTask,
    cancelTask,
    deleteTask,
  } = useTasks({ limit: 30 });

  const { drones: dronesForMap, loading: dronesApiLoading } = useDrones();

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e: MouseEvent) => resizeSidebar(e.clientX);
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resizeSidebar]);

  useTelemetryConnection();
  // The page only needs which drones are live and which one is selected, so it
  // re-renders when those change, not on every packet. useShallow keeps the
  // array stable while the set of drones stays the same.
  const droneIds = useTelemetryStore(useShallow((s) => liveDroneIdsOf(s.byDrone)));
  const selectedDroneId = useTelemetryStore((s) => s.selectedDroneId);
  const setRunState = useTelemetryStore((s) => s.setRunState);
  const clearPathsAndIdle = useTelemetryStore((s) => s.clearPathsAndIdle);
  const { location: userLocation, isLoading: locationLoading } = useUserLocation();
  const { theme, toggleTheme } = useTheme();

  /** Sync runState from API task list so after refresh we show running/paused correctly; only when tasks have loaded to avoid resetting to idle too early. */
  useEffect(() => {
    if (tasksLoading) return;
    const hasRunning = tasks.some((t) => t.status === "running");
    const hasPaused = tasks.some((t) => t.status === "paused");
    if (hasRunning) setRunState("running");
    else if (hasPaused) setRunState("paused");
    else setRunState("idle");
  }, [tasks, tasksLoading, setRunState]);

  const handleStartTask = useCallback(
    async (taskId: number) => {
      const ok = await startTask(taskId);
      if (ok) setRunState("running");
    },
    [startTask, setRunState]
  );

  const handleCancelTask = useCallback(
    async (taskId: number) => {
      const ok = await cancelTask(taskId);
      if (ok) clearPathsAndIdle();
    },
    [cancelTask, clearPathsAndIdle]
  );

  const handleDeleteTask = useCallback(
    async (taskId: number) => {
      const ok = await deleteTask(taskId);
      if (ok) clearPathsAndIdle();
    },
    [deleteTask, clearPathsAndIdle]
  );

  useEffect(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    if (completed.length === 0) return;
    const latest = completed.sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
        new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    )[0];
    const firstAssignment = latest.assignments?.[0];
    if (firstAssignment) {
      setLastEndPoint({ lat: firstAssignment.dest_lat, lng: firstAssignment.dest_lng });
    }
  }, [tasks]);

  const activeTasks = useMemo(
    () => tasks.filter(isActiveTask),
    [tasks]
  );

  /** 已被進行中任務占用的無人機 ID，建立任務表單應排除這些無人機避免重複指派 */
  const droneIdsInActiveTasks = useMemo(
    () =>
      new Set(
        activeTasks.flatMap((t) => (t.assignments ?? []).map((a) => a.drone_id))
      ),
    [activeTasks]
  );

  /** 有任務在跑或已有即時遙測（地圖用：決定是否顯示多機／跟隨模式） */
  const hasActiveTasksOrLiveTelemetry = useMemo(
    () => activeTasks.length > 0 || droneIds.length > 0,
    [activeTasks.length, droneIds.length]
  );

  /** 地圖要顯示的無人機 ID：有任務在跑或已有遙測時用「即時遙測 + 進行中任務指派 + 有上次位置的待命機」聯集，否則用有上次終止位置的無人機 */
  const droneIdsForMap = useMemo(() => {
    const withLastPosition = dronesForMap
      .filter((d) => d.last_lat != null && d.last_lng != null)
      .map((d) => d.id);
    if (hasActiveTasksOrLiveTelemetry) {
      const fromTelemetry = droneIds;
      const fromAssignments = activeTasks.flatMap((t) =>
        (t.assignments ?? []).map((a) => a.drone_id)
      );
      return Array.from(new Set([...fromTelemetry, ...fromAssignments, ...withLastPosition]));
    }
    return withLastPosition;
  }, [hasActiveTasksOrLiveTelemetry, droneIds, activeTasks, dronesForMap]);

  /** 沒有無人機可顯示時，API 載完即可解除 loading */
  useEffect(() => {
    if (!dronesApiLoading && droneIdsForMap.length === 0) {
      setPageLoading(false);
    }
  }, [dronesApiLoading, droneIdsForMap.length, setPageLoading]);

  const handleAllDroneMarkersMounted = useCallback(() => {
    setPageLoading(false);
  }, [setPageLoading]);

  const lastPositionByDrone = useMemo(() => {
    const out: Record<number, { lat: number; lng: number }> = {};
    for (const d of dronesForMap) {
      if (d.last_lat != null && d.last_lng != null) {
        out[d.id] = { lat: d.last_lat, lng: d.last_lng };
      }
    }
    return out;
  }, [dronesForMap]);

  /** Map center when no drone is live; LiveMapView follows the selected drone otherwise. */
  const fallbackCenter = useMemo(() => {
    if (droneIdsForMap.length > 0 && lastPositionByDrone[droneIdsForMap[0]]) {
      const pos = lastPositionByDrone[droneIdsForMap[0]];
      return { lat: pos.lat, lng: pos.lng };
    }
    return userLocation ?? FALLBACK_CENTER;
  }, [droneIdsForMap, lastPositionByDrone, userLocation]);

  /** Where the selected drone is heading, for the ETA in the telemetry bar. */
  const selectedDestination = useMemo(() => {
    for (const task of activeTasks) {
      const assignment = (task.assignments ?? []).find(
        (a) => a.drone_id === selectedDroneId && a.status !== "arrived" && a.status !== "cancelled"
      );
      if (assignment) return { lat: assignment.dest_lat, lng: assignment.dest_lng };
    }
    return null;
  }, [activeTasks, selectedDroneId]);

  const taskAssignmentsForMap = useMemo(() => {
    return activeTasks.flatMap((t) =>
      (t.assignments ?? []).map((a) => ({
        start_lat: a.start_lat,
        start_lng: a.start_lng,
        dest_lat: a.dest_lat,
        dest_lng: a.dest_lng,
        drone_name: a.drone_name ?? undefined,
      }))
    );
  }, [activeTasks]);

  const showMap = droneIdsForMap.length > 0 || !locationLoading;

  /** 左下方區塊要顯示的選中無人機名稱（依地圖上的機體與選取狀態，有 API 名稱則用名稱） */
  const activeDroneDisplayName = useMemo(() => {
    if (droneIdsForMap.length < 1) return undefined;
    const effectiveId = selectedDroneId === 0 ? droneIdsForMap[0] : selectedDroneId;
    if (effectiveId == null) return undefined;
    const drone = dronesForMap.find((d) => d.id === effectiveId);
    if (drone?.name) return drone.name;
    return t("common.droneFallback", { id: selectedDroneId === 0 ? 1 : selectedDroneId });
  }, [droneIdsForMap, selectedDroneId, dronesForMap, t]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {pageLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-5 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Satellite className="h-5 w-5 text-foreground" />
          <h1 className="text-base font-semibold tracking-tight text-foreground">InsightAero</h1>
          <span className="border-l border-border pl-3 text-xs text-muted-foreground">
            {t("app.tagline")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionIndicator />
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground"
            aria-label={theme === "dark" ? t("app.switchToLight") : t("app.switchToDark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>
      {isBackendUnreachable(tasksLoadError) && <BackendStatusBanner />}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 p-3 flex min-h-[320px]">
            <div className="min-h-0 flex-1 min-w-0">
              {showMap ? (
                <LiveMapView
                  fallbackCenter={fallbackCenter}
                  isRunning={hasActiveTasksOrLiveTelemetry}
                  historyPath={historyPath}
                  origin={undefined}
                  destination={undefined}
                  taskAssignments={taskAssignmentsForMap.length > 0 ? taskAssignmentsForMap : null}
                  droneIds={droneIdsForMap}
                  lastPositionByDrone={lastPositionByDrone}
                  onAllDroneMarkersMounted={handleAllDroneMarkersMounted}
                />
              ) : (
                <div className="flex min-h-[280px] w-full flex-1 items-center justify-center rounded-lg border border-border bg-card shadow-raised text-muted-foreground text-sm">
                  {t("app.gettingLocation")}
                </div>
              )}
            </div>
            {showMap && (
              /* Bottom of the map: AI navigator above the telemetry bar. Kept clear of
                 the map's bottom edge so Google's logo and terms stay visible. */
              <div className="pointer-events-none absolute inset-x-6 bottom-9 z-10 flex flex-col items-start gap-3">
                <AIFloatingNavigator />
                {activeDroneDisplayName && (
                  <TelemetryHUD
                    droneLabel={activeDroneDisplayName}
                    destination={selectedDestination}
                    className="pointer-events-auto w-full"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <aside
          aria-label={t("sidebar.label")}
          className="relative flex shrink-0 flex-col border-l border-border p-3"
          style={{ width: sidebarWidth }}
        >
          <button
            type="button"
            aria-label={t("app.resizeSidebar")}
            onMouseDown={startResize}
            className={`absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize touch-none -translate-x-1/2 hover:bg-primary/20 transition-colors ${isResizing ? "bg-primary/40" : ""}`}
          />
          {/* One scroll container per tab, so lists never scroll inside a scrolling sidebar.
              Tabs stay mounted (forceMount) to keep each list's state when switching. */}
          <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Tabs
              value={sidebarTab}
              onValueChange={(value) => setSidebarTab(value as SidebarTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList>
                <TabsTrigger value="missions">
                  {t("sidebar.missions")}
                  {activeTasks.length > 0 && (
                    <span
                      className="rounded-full bg-surface-selected px-1.5 text-[11px] font-semibold leading-4 tabular-nums text-interactive-text"
                      aria-label={t("sidebar.activeCount", { count: activeTasks.length })}
                    >
                      {activeTasks.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="fleet">{t("sidebar.fleet")}</TabsTrigger>
                <TabsTrigger value="history">{t("sidebar.history")}</TabsTrigger>
              </TabsList>

              <TabsContent value="missions" forceMount className="flex min-h-0 flex-1 flex-col">
                <PanelHeader>
                  <span className="text-xs text-muted-foreground">
                    {tasks.length > 0 || (!tasksLoading && !tasksLoadError)
                      ? t("sidebar.activeCount", { count: activeTasks.length })
                      : null}
                  </span>
                  <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t("taskForm.title")}
                  </Button>
                </PanelHeader>
                <TaskList
                  className="flex-1"
                  tasks={tasks}
                  onStart={handleStartTask}
                  onPause={pauseTask}
                  onResume={resumeTask}
                  onCancel={handleCancelTask}
                  onDelete={handleDeleteTask}
                  onTaskClick={(id) => setSelectedTaskId(id)}
                  loading={tasksLoading}
                  loadError={tasksLoadError}
                  onRetry={() => fetchTasks()}
                  retrying={tasksRefetching}
                  onCreate={() => setCreateOpen(true)}
                />
              </TabsContent>

              <TabsContent value="fleet" forceMount className="flex min-h-0 flex-1 flex-col">
                <MyDronesList className="flex-1" />
              </TabsContent>

              <TabsContent value="history" forceMount className="flex min-h-0 flex-1 flex-col">
                <FlightSessionsList
                  className="flex-1"
                  onSelectSession={(_id, path) => setHistoryPath(path)}
                />
              </TabsContent>
            </Tabs>
          </Panel>
        </aside>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("taskForm.title")}</DialogTitle>
            <DialogDescription>{t("taskForm.description")}</DialogDescription>
          </DialogHeader>
          <TaskCreateForm
            effectiveStart={lastEndPoint}
            onCreate={createTask}
            onSuccess={() => {
              setCreateOpen(false);
              setSidebarTab("missions");
            }}
            onAddressError={() => setAddressErrorOpen(true)}
            excludeDroneIds={droneIdsInActiveTasks}
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
            <AlertDialogDescription>
              {t("addressError.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAddressErrorOpen(false)}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
