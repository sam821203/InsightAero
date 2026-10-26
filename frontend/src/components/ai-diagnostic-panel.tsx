import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TelemetryPacket } from "@/types/telemetry";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelTitle } from "@/components/ui/panel";
import { diagnoseSession, diagnoseTelemetry } from "@/api/diagnose";
import type { ApiError } from "@/api/client";
import {
  selectActiveTelemetry,
  selectHasLiveTelemetry,
  useTelemetryStore,
} from "@/stores/telemetry-store";
import { useTranslation } from "react-i18next";
import { useMissionInFlight } from "@/api/tasks.queries";
import { formatClockTime } from "@/lib/format";
import type { Messages } from "@/locales/types";

type AiLogKey = keyof Messages["ai"]["log"];

type LogContent =
  | { key: AiLogKey; params?: Record<string, string | number> }
  | { raw: string };

interface LogEntry {
  id: number;
  timestamp: number;
  type: "info" | "warning" | "status" | "diagnosis";
  content: LogContent;
}

function toSnapshot(t: TelemetryPacket): Record<string, number> {
  return {
    lat: t.lat,
    lng: t.lng,
    alt: t.alt,
    speed: t.speed,
    heading: t.heading,
    battery: t.battery,
    wind_speed: t.wind_speed,
    wind_deg: t.wind_deg,
    effective_speed_m_min: t.effective_speed_m_min,
  };
}

const STATUS_MESSAGES = [
  "statusStable",
  "statusTelemetry",
  "statusWind",
  "statusNavigation",
] as const satisfies readonly AiLogKey[];

function generateInsight(t: TelemetryPacket, prev: TelemetryPacket | null): Omit<LogEntry, "id" | "timestamp"> {
  if (t.battery < 15) {
    return {
      type: "warning",
      content: { key: "batteryCritical", params: { battery: t.battery.toFixed(1) } },
    };
  }
  if (t.battery < 30 && (!prev || prev.battery >= 30)) {
    return {
      type: "warning",
      content: { key: t.wind_speed > 20 ? "batteryLowHighWind" : "batteryLow" },
    };
  }
  if (t.effective_speed_m_min < 300) {
    return {
      type: "warning",
      content: { key: "headwindSlowdown", params: { speed: t.effective_speed_m_min } },
    };
  }
  if (t.wind_speed > 35) {
    return {
      type: "warning",
      content: { key: "windExceeded", params: { wind: t.wind_speed } },
    };
  }

  const key = STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
  return {
    type: "status",
    content: {
      key,
      params: {
        lat: t.lat.toFixed(4),
        lng: t.lng.toFixed(4),
        alt: t.alt,
        heading: t.heading.toFixed(1),
        speed: t.effective_speed_m_min,
      },
    },
  };
}

interface Props {
  /** 隱藏標題列（用於嵌入浮動 dialog 時，標題已在 dialog header 顯示） */
  hideTitle?: boolean;
}

export default function AIDiagnosticPanel({ hideTitle }: Props) {
  const { t, i18n } = useTranslation();
  // Derived from the mission list (shared query), not copied into a store.
  const isRunning = useMissionInFlight();
  const canDiagnose = useTelemetryStore(selectHasLiveTelemetry);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const prevRef = useRef<TelemetryPacket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  const appendLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      ...prev.slice(-50),
      { ...entry, id: Date.now() + Math.random(), timestamp: Date.now() },
    ]);
  }, []);

  const handleDiagnose = useCallback(async () => {
    if (isDiagnosing || !canDiagnose) return;
    setIsDiagnosing(true);
    // Read the latest packet at click time instead of subscribing to every update.
    const telemetry = selectActiveTelemetry(useTelemetryStore.getState());
    try {
      const data =
        telemetry.session_id != null
          ? await diagnoseSession(telemetry.session_id)
          : await diagnoseTelemetry([toSnapshot(telemetry)]);
      appendLog({ type: "diagnosis", content: { raw: data.diagnosis ?? "" } });
    } catch (err) {
      const message =
        (err as ApiError).detail ?? (err instanceof Error ? err.message : String(err));
      appendLog({ type: "warning", content: { key: "diagnoseFailed", params: { message } } });
    } finally {
      setIsDiagnosing(false);
    }
  }, [canDiagnose, isDiagnosing, appendLog]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!isRunning) return;
    setLogs([
      {
        id: Date.now(),
        timestamp: Date.now(),
        type: "info",
        content: { key: "online" },
      },
    ]);
    tickRef.current = 0;
  }, [isRunning]);

  const renderContent = (content: LogContent) => {
    if ("raw" in content) return content.raw;
    return t(`ai.log.${content.key}`, content.params);
  };

  const colorMap: Record<LogEntry["type"], string> = {
    info: "text-foreground",
    warning: "text-warning-text",
    status: "text-muted-foreground",
    diagnosis: "text-foreground",
  };

  return (
    <div className="flex min-h-[220px] shrink-0 flex-col overflow-hidden bg-card">
      {!hideTitle && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BrainCircuit className="h-4 w-4 text-subtle-foreground" />
          <PanelTitle as="h2">{t("ai.title")}</PanelTitle>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1.5 text-xs leading-relaxed">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="shrink-0 font-mono text-subtle-foreground">
                {formatClockTime(log.timestamp, i18n.language)}
              </span>
              <span
                className={`${colorMap[log.type]} ${log.type === "diagnosis" ? "whitespace-pre-wrap" : ""}`}
              >
                {renderContent(log.content)}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${isRunning ? "bg-success" : "bg-border-strong"}`} />
          <span className="text-xs text-muted-foreground">{isRunning ? t("ai.missionActive") : t("ai.idle")}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!canDiagnose || isDiagnosing}
          onClick={handleDiagnose}
        >
          {isDiagnosing ? t("ai.diagnosing") : t("ai.diagnose")}
        </Button>
      </div>
    </div>
  );
}
