import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTelemetryStore } from "@/stores/telemetryStore";
import {
  batteryLevel,
  distanceMeters,
  etaMinutes,
  windLevel,
  windRelation,
  type LatLng,
  type Level,
} from "@/lib/flight";
import { cn } from "@/lib/utils";

interface Props {
  /** Name of the selected drone. */
  droneLabel: string;
  /** Destination of the selected drone's active assignment, used for ETA. */
  destination?: LatLng | null;
  className?: string;
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

const EMPTY = "—";

function PrimaryMetric({
  label,
  value,
  unit,
  tone = "nominal",
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Level;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-[96px] flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-semibold leading-none tracking-tight tabular-nums",
            LEVEL_TEXT[tone]
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-subtle-foreground">{unit}</span>}
      </span>
      {children}
    </div>
  );
}

function SecondaryMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Telemetry bar overlaid on the bottom of the map. The three numbers an
 * operator acts on (battery, effective speed, ETA) are large; the rest sit in
 * one small row. Color only appears when a value needs attention.
 */
function TelemetryHUDInner({ droneLabel, destination, className }: Props) {
  const { t, i18n } = useTranslation();
  // Undefined when the selected drone isn't sending telemetry (e.g. idle on the map).
  const telemetry = useTelemetryStore((s) => s.byDrone[s.selectedDroneId]);

  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value);

  const formatEta = (minutes: number) => {
    if (minutes < 1) return t("hud.etaUnderMinute");
    const rounded = Math.round(minutes);
    if (rounded < 60) return t("hud.etaMinutes", { minutes: rounded });
    return t("hud.etaHours", { hours: Math.floor(rounded / 60), minutes: rounded % 60 });
  };

  const formatDistance = (meters: number) =>
    meters < 1000 ? `${number(meters)} m` : `${number(meters / 1000, 1)} km`;

  const live = telemetry != null;
  const battery = live ? Math.max(0, telemetry.battery) : null;
  const batteryTone = battery != null ? batteryLevel(battery) : "nominal";

  const remaining = live && destination ? distanceMeters(telemetry, destination) : null;
  const eta =
    live && remaining != null ? etaMinutes(remaining, telemetry.effective_speed_m_min) : null;

  const windTone = live ? windLevel(telemetry.wind_speed) : "nominal";
  const relation = live
    ? windRelation(telemetry.heading, telemetry.wind_speed, telemetry.wind_deg)
    : null;

  return (
    <section
      aria-label={t("hud.title")}
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border bg-popover/95 px-4 py-3 shadow-overlay backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
      <div className="flex min-w-[120px] flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", live ? "bg-success" : "bg-border-strong")}
            aria-hidden
          />
          {live ? t("hud.live") : t("hud.noTelemetry")}
        </span>
        <span className="truncate text-base font-semibold text-foreground">{droneLabel}</span>
      </div>

      <div className="hidden w-px self-stretch bg-border sm:block" aria-hidden />

      <PrimaryMetric
        label={t("hud.battery")}
        value={battery != null ? number(battery, 1) : EMPTY}
        unit={battery != null ? "%" : undefined}
        tone={batteryTone}
      >
        <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full transition-all duration-500", LEVEL_FILL[batteryTone])}
            style={{ width: `${battery ?? 0}%` }}
          />
        </span>
      </PrimaryMetric>

      <PrimaryMetric
        label={t("hud.effectiveSpeed")}
        value={live ? number(telemetry.effective_speed_m_min) : EMPTY}
        unit={live ? "m/min" : undefined}
      />

      <PrimaryMetric label={t("hud.eta")} value={eta != null ? formatEta(eta) : EMPTY}>
        <span className="text-xs text-subtle-foreground">
          {remaining != null
            ? t("hud.distanceRemaining", { distance: formatDistance(remaining) })
            : live
              ? t("hud.noDestination")
              : " "}
        </span>
      </PrimaryMetric>

      </div>

      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-border pt-2 text-xs">
        <SecondaryMetric label={t("hud.altitude")}>
          {live ? `${number(telemetry.alt)} m` : EMPTY}
        </SecondaryMetric>
        <SecondaryMetric label={t("hud.heading")}>
          {live ? `${number(telemetry.heading)}°` : EMPTY}
        </SecondaryMetric>
        <SecondaryMetric label={t("hud.speed")}>
          {live ? `${number(telemetry.speed)} m/min` : EMPTY}
        </SecondaryMetric>
        <SecondaryMetric label={t("hud.wind")}>
          {live ? (
            <span className={windTone === "nominal" ? undefined : cn("font-medium", LEVEL_TEXT[windTone])}>
              {number(telemetry.wind_speed, 1)} m/s · {number(telemetry.wind_deg)}°
              {relation && <span className="ml-1 text-muted-foreground">({t(`hud.${relation}`)})</span>}
            </span>
          ) : (
            EMPTY
          )}
        </SecondaryMetric>
      </dl>
    </section>
  );
}

/** Memoized so parent re-renders don't re-render the bar; it updates from the store. */
export default memo(TelemetryHUDInner);
