import type { TelemetryPacket } from "@/types/telemetry";
import { Wind, Navigation } from "lucide-react";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const isHeadwind = effectiveSpeedMmin != null && baseSpeedMmin != null && effectiveSpeedMmin < baseSpeedMmin * 0.95;
  const isTailwind = effectiveSpeedMmin != null && baseSpeedMmin != null && effectiveSpeedMmin > baseSpeedMmin * 1.05;

  return (
    <Panel className="flex min-w-[220px] flex-col gap-4 p-4">
      <PanelTitle>{t("weather.title")}</PanelTitle>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wind className="h-3.5 w-3.5 text-subtle-foreground" />
            <span className="text-xs text-muted-foreground">{t("weather.windSpeed")}</span>
          </div>
          <span className="text-sm font-medium tabular-nums text-foreground">{windSpeed} m/s</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Navigation
              className="h-3.5 w-3.5 text-subtle-foreground"
              style={{ transform: `rotate(${windDeg}deg)` }}
            />
            <span className="text-xs text-muted-foreground">{t("weather.windDirection")}</span>
          </div>
          <span className="text-sm font-medium tabular-nums text-foreground">{windDeg}°</span>
        </div>
      </div>

      {(isHeadwind || isTailwind) && (
        <p className="text-xs text-muted-foreground">
          {isHeadwind && t("weather.headwind")}
          {isTailwind && t("weather.tailwind")}
        </p>
      )}
    </Panel>
  );
}
