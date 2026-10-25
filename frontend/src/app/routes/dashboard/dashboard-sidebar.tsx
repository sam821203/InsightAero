import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResizableSidebar from "@/components/layouts/resizable-sidebar";
import FleetList from "@/features/fleet/components/fleet-list";
import FlightHistoryList from "@/features/flight-history/components/flight-history-list";
import type { FlightPathPoint } from "@/types/telemetry";

export type SidebarTab = "missions" | "fleet" | "history";

interface DashboardSidebarProps {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  activeMissionCount: number;
  /** Missions tab body; composed by the dashboard because it shares state with the map. */
  missions: ReactNode;
  onSelectFlightPath: (path: FlightPathPoint[]) => void;
}

/**
 * Sidebar tabs. One scroll container per tab, so lists never scroll inside a
 * scrolling sidebar. Tabs stay mounted (forceMount) to keep each list's state
 * when switching.
 */
export default function DashboardSidebar({
  tab,
  onTabChange,
  activeMissionCount,
  missions,
  onSelectFlightPath,
}: DashboardSidebarProps) {
  const { t } = useTranslation();

  return (
    <ResizableSidebar label={t("sidebar.label")}>
      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as SidebarTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList>
            <TabsTrigger value="missions">
              {t("sidebar.missions")}
              {activeMissionCount > 0 && (
                <span
                  className="rounded-full bg-surface-selected px-1.5 text-[11px] font-semibold leading-4 tabular-nums text-interactive-text"
                  aria-label={t("sidebar.activeCount", { count: activeMissionCount })}
                >
                  {activeMissionCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fleet">{t("sidebar.fleet")}</TabsTrigger>
            <TabsTrigger value="history">{t("sidebar.history")}</TabsTrigger>
          </TabsList>

          <TabsContent value="missions" forceMount className="flex min-h-0 flex-1 flex-col">
            {missions}
          </TabsContent>

          <TabsContent value="fleet" forceMount className="flex min-h-0 flex-1 flex-col">
            <FleetList className="flex-1" />
          </TabsContent>

          <TabsContent value="history" forceMount className="flex min-h-0 flex-1 flex-col">
            <FlightHistoryList className="flex-1" onSelectSession={(_id, path) => onSelectFlightPath(path)} />
          </TabsContent>
        </Tabs>
      </Panel>
    </ResizableSidebar>
  );
}
