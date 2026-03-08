import { memo } from "react";
import type { TelemetryPacket } from "@/types/telemetry";
import { Activity, Compass, Gauge, MapPin, Mountain, Zap } from "lucide-react";

interface Props {
  telemetry: TelemetryPacket;
  /** 目前選中的無人機名稱，顯示在左側卡片區塊 */
  activeDroneLabel?: string;
}

function GaugeCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex h-[116px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-3">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`font-display text-xl font-bold ${color}`}>{value}</span>
      <span className="min-h-[14px] text-[10px] text-muted-foreground leading-tight">{unit}</span>
    </div>
  );
}

function TelemetryHUDInner({ telemetry, activeDroneLabel }: Props) {
  const batteryColor =
    telemetry.battery > 60 ? "text-primary" : telemetry.battery > 25 ? "text-warning" : "text-destructive";
  const batteryPct = Math.max(0, telemetry.battery);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
      {activeDroneLabel != null && activeDroneLabel !== "" && (
        <div className="flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)_/_.2)] p-3 ring-2 ring-primary/20">
          <MapPin className="h-5 w-5 shrink-0 text-primary" />
          <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-primary">目前機體</span>
          <span className="font-display text-xl font-bold text-primary leading-tight text-center break-words">
            {activeDroneLabel}
          </span>
        </div>
      )}
      <GaugeCard icon={Mountain} label="Altitude" value={telemetry.alt} unit="m" color="text-primary" />
      <GaugeCard icon={Compass} label="Heading" value={telemetry.heading.toFixed(1)} unit="°" color="text-primary" />
      <GaugeCard icon={Activity} label="Speed" value={telemetry.speed} unit="" color="text-primary" />
      <GaugeCard
        icon={Gauge}
        label="Eff. Speed"
        value={telemetry.effective_speed_m_min}
        unit="m/min"
        color="text-primary"
      />
      <div className="flex h-[116px] min-w-[140px] flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-3">
        <Zap className={`h-4 w-4 shrink-0 ${batteryColor}`} />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Battery</span>
        <span className={`font-display text-xl font-bold ${batteryColor}`}>{batteryPct.toFixed(1)}%</span>
        <div className="flex min-h-[14px] w-full items-center">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                telemetry.battery > 60 ? "bg-primary" : telemetry.battery > 25 ? "bg-warning" : "bg-destructive"
              }`}
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
