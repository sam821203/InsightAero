import { memo } from "react";
import { selectActiveTelemetry, useTelemetryStore } from "@/stores/telemetryStore";
import { Activity, Compass, Gauge, MapPin, Mountain, Zap } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { useTranslation } from "react-i18next";

const LABEL = "text-xs font-medium leading-tight text-muted-foreground";
const VALUE = "text-2xl font-semibold leading-tight tracking-tight tabular-nums";
const UNIT = "min-h-[14px] text-xs leading-tight text-subtle-foreground";

interface Props {
  /** 目前選中的無人機名稱，顯示在左側卡片區塊 */
  activeDroneLabel?: string;
}

type Level = "nominal" | "warning" | "critical";

function batteryLevel(battery: number): Level {
  if (battery > 60) return "nominal";
  if (battery > 25) return "warning";
  return "critical";
}

const LEVEL_TEXT: Record<Level, string> = {
  nominal: "text-foreground",
  warning: "text-warning-text",
  critical: "text-destructive-text",
};

const LEVEL_FILL: Record<Level, string> = {
  nominal: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

function GaugeCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
}) {
  return (
    <Panel className="flex h-[116px] min-w-[120px] flex-col items-center justify-center gap-1 p-3">
      <Icon className="h-4 w-4 shrink-0 text-subtle-foreground" />
      <span className={LABEL}>{label}</span>
      <span className={`${VALUE} text-foreground`}>{value}</span>
      <span className={UNIT}>{unit}</span>
    </Panel>
  );
}

function TelemetryHUDInner({ activeDroneLabel }: Props) {
  const { t } = useTranslation();
  // Re-renders only when the selected drone sends a packet.
  const telemetry = useTelemetryStore(selectActiveTelemetry);
  const batteryPct = Math.max(0, telemetry.battery);
  const level = batteryLevel(telemetry.battery);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
      {activeDroneLabel != null && activeDroneLabel !== "" && (
        <div className="flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1.5 rounded-lg border border-interactive bg-surface-selected p-3">
          <MapPin className="h-5 w-5 shrink-0 text-interactive-text" />
          <span className={LABEL}>{t("hud.selectedDrone")}</span>
          <span className="text-lg font-semibold leading-tight tracking-tight text-foreground text-center break-words">
            {activeDroneLabel}
          </span>
        </div>
      )}
      <GaugeCard icon={Mountain} label={t("hud.altitude")} value={telemetry.alt} unit="m" />
      <GaugeCard icon={Compass} label={t("hud.heading")} value={telemetry.heading.toFixed(1)} unit="°" />
      <GaugeCard icon={Activity} label={t("hud.speed")} value={telemetry.speed} unit="m/min" />
      <GaugeCard
        icon={Gauge}
        label={t("hud.effectiveSpeed")}
        value={telemetry.effective_speed_m_min}
        unit="m/min"
      />
      <Panel className="flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1 p-3">
        <Zap className={`h-4 w-4 shrink-0 ${level === "nominal" ? "text-subtle-foreground" : LEVEL_TEXT[level]}`} />
        <span className={LABEL}>{t("hud.battery")}</span>
        <span className={`${VALUE} ${LEVEL_TEXT[level]}`}>{batteryPct.toFixed(1)}%</span>
        <div className="flex min-h-[14px] w-full items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${LEVEL_FILL[level]}`}
              style={{ width: `${batteryPct}%` }}
            />
          </div>
        </div>
      </Panel>
      </div>
    </div>
  );
}

/** Memoized so parent re-renders (e.g. drone list changes) don't re-render the HUD. */
export default memo(TelemetryHUDInner);
