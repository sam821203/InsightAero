import { memo } from "react";
import type { TelemetryPacket } from "@/types/telemetry";
import { Activity, Compass, Gauge, MapPin, Mountain, Zap } from "lucide-react";

interface Props {
  telemetry: TelemetryPacket;
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
    <div className="panel flex h-[116px] min-w-[120px] flex-col items-center justify-center gap-1 p-3">
      <Icon className="h-4 w-4 shrink-0 text-subtle-foreground" />
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      <span className="metric-unit min-h-[14px] leading-tight">{unit}</span>
    </div>
  );
}

function TelemetryHUDInner({ telemetry, activeDroneLabel }: Props) {
  const batteryPct = Math.max(0, telemetry.battery);
  const level = batteryLevel(telemetry.battery);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
      {activeDroneLabel != null && activeDroneLabel !== "" && (
        <div className="flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--metric-selected-border))] bg-[hsl(var(--metric-selected-bg))] p-3">
          <MapPin className="h-5 w-5 shrink-0 text-interactive-text" />
          <span className="metric-label">目前機體</span>
          <span className="text-lg font-semibold leading-tight tracking-tight text-foreground text-center break-words">
            {activeDroneLabel}
          </span>
        </div>
      )}
      <GaugeCard icon={Mountain} label="Altitude" value={telemetry.alt} unit="m" />
      <GaugeCard icon={Compass} label="Heading" value={telemetry.heading.toFixed(1)} unit="°" />
      <GaugeCard icon={Activity} label="Speed" value={telemetry.speed} unit="" />
      <GaugeCard
        icon={Gauge}
        label="Eff. Speed"
        value={telemetry.effective_speed_m_min}
        unit="m/min"
      />
      <div className="panel flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1 p-3">
        <Zap className={`h-4 w-4 shrink-0 ${level === "nominal" ? "text-subtle-foreground" : LEVEL_TEXT[level]}`} />
        <span className="metric-label">Battery</span>
        <span className={`metric-value ${LEVEL_TEXT[level]}`}>{batteryPct.toFixed(1)}%</span>
        <div className="flex min-h-[14px] w-full items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${LEVEL_FILL[level]}`}
              style={{ width: `${batteryPct}%` }}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Memoized to avoid re-renders when parent updates from WebSocket; only re-renders when telemetry or activeDroneLabel change. */
export default memo(TelemetryHUDInner);
