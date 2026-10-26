import { useState, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useTelemetryConnection } from "@/hooks/use-telemetry-connection";
import { liveDroneIdsOf, useTelemetryStore } from "@/stores/telemetry-store";
import { useUserLocation, FALLBACK_CENTER } from "@/hooks/use-user-location";
import { useDrones } from "@/api/drones.queries";
import { useTasks } from "@/api/tasks.queries";
import { isBackendUnreachable } from "@/api/client";
import { isActiveTask } from "@/utils/task-status";
import LiveMapView from "@/components/live-map-view";
import TelemetryHUD from "@/components/telemetry-hud";
import AIFloatingNavigator from "@/components/ai-floating-navigator";
import ConnectionIndicator from "@/components/connection-indicator";
import BackendStatusBanner from "@/components/backend-status-banner";
import AppHeader from "@/components/layouts/app-header";
import PageLoader from "@/components/layouts/page-loader";
import MissionsPanel from "@/features/missions/components/missions-panel";
import { useMissionStatusSync } from "@/features/missions/hooks/use-mission-status-sync";
import type { FlightPathPoint } from "@/types/telemetry";
import DashboardSidebar, { type SidebarTab } from "./dashboard-sidebar";

/**
 * The dashboard composes features: it reads the shared mission and drone
 * lists, derives what the map needs, and passes data between features
 * (e.g. the selected flight path from history to the map).
 */
export default function DashboardRoute() {
  const { t } = useTranslation();
  const [historyPath, setHistoryPath] = useState<FlightPathPoint[] | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("missions");
  const [pageLoading, setPageLoading] = useState(true);

  const {
    tasks,
    loaded: tasksLoaded,
    loading: tasksLoading,
    loadError: tasksLoadError,
    refetching: tasksRefetching,
    refetch: refetchTasks,
  } = useTasks();
  useMissionStatusSync(tasks, tasksLoaded);

  const { drones: dronesForMap, loading: dronesApiLoading } = useDrones();

  useTelemetryConnection();
  // The page only needs which drones are live and which one is selected, so it
  // re-renders when those change, not on every packet. useShallow keeps the
  // array stable while the set of drones stays the same.
  const droneIds = useTelemetryStore(useShallow((s) => liveDroneIdsOf(s.byDrone)));
  const selectedDroneId = useTelemetryStore((s) => s.selectedDroneId);
  const clearPaths = useTelemetryStore((s) => s.clearPaths);
  const { location: userLocation, isLoading: locationLoading } = useUserLocation();

  const activeTasks = useMemo(
    () => tasks.filter(isActiveTask),
    [tasks]
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
      {pageLoading && <PageLoader />}
      <AppHeader status={<ConnectionIndicator />} />
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

        <DashboardSidebar
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          activeMissionCount={activeTasks.length}
          onSelectFlightPath={setHistoryPath}
          missions={
            <MissionsPanel
              className="flex min-h-0 flex-1 flex-col"
              tasks={tasks}
              loading={tasksLoading}
              loadError={tasksLoadError}
              refetching={tasksRefetching}
              onRetry={() => refetchTasks()}
              onMissionEnded={clearPaths}
            />
          }
        />
      </div>

    </div>
  );
}
