import type { TelemetryPacket } from "@/types/telemetry";
import { Wind, Navigation } from "lucide-react";

interface Props {
  /** 顯示即時氣象（來自 OpenWeather / 後端推播） */
  windSpeed: number;
  windDeg: number;
  /** 若有受逆風/順風影響，可顯示提示 */
  effectiveSpeedMmin?: number;
  baseSpeedMmin?: number;
}

export default function WeatherControls({
  windSpeed,
  windDeg,
  effectiveSpeedMmin,
  baseSpeedMmin,
}: Props) {
  const isHeadwind = effectiveSpeedMmin != null && baseSpeedMmin != null && effectiveSpeedMmin < baseSpeedMmin * 0.95;
  const isTailwind = effectiveSpeedMmin != null && baseSpeedMmin != null && effectiveSpeedMmin > baseSpeedMmin * 1.05;

  return (
    <div className="flex min-w-[220px] flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <h3 className="font-display text-xs uppercase tracking-widest text-primary">即時氣象</h3>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wind className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">風速</span>
          </div>
          <span className="font-display text-sm text-primary">{windSpeed} m/s</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Navigation
              className="h-3.5 w-3.5 text-primary"
              style={{ transform: `rotate(${windDeg}deg)` }}
            />
            <span className="text-xs text-muted-foreground">風向</span>
          </div>
          <span className="font-display text-sm text-primary">{windDeg}°</span>
        </div>
      </div>

      {(isHeadwind || isTailwind) && (
        <p className="text-[10px] text-muted-foreground">
          {isHeadwind && "受逆風影響，有效分速下降"}
          {isTailwind && "順風，有效分速提升"}
        </p>
      )}
    </div>
  );
}
