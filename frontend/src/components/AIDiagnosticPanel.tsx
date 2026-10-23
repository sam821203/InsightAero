import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TelemetryPacket } from "@/types/telemetry";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelTitle } from "@/components/ui/panel";
import { diagnoseSession, diagnoseTelemetry } from "@/api/diagnose";
import type { ApiError } from "@/api/client";

interface LogEntry {
  id: number;
  text: string;
  type: "info" | "warning" | "status" | "diagnosis";
  time: string;
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

function generateInsight(t: TelemetryPacket, prev: TelemetryPacket | null): LogEntry | null {
  const now = new Date().toLocaleTimeString("zh-TW", { hour12: false });
  const id = Date.now() + Math.random();

  if (t.battery < 15) {
    return {
      id,
      time: now,
      type: "warning",
      text: `⚠ 電池嚴重不足 ${t.battery.toFixed(1)}%，建議立即返航。`,
    };
  }
  if (t.battery < 30 && (!prev || prev.battery >= 30)) {
    return {
      id,
      time: now,
      type: "warning",
      text: `⚠ 電池低於 30%。風載係數: ${t.wind_speed > 20 ? "高" : "正常"}`,
    };
  }
  if (t.effective_speed_m_min < 300) {
    return {
      id,
      time: now,
      type: "warning",
      text: `分析：地速降至 ${t.effective_speed_m_min} m/min（逆風）。電池效率受影響。`,
    };
  }
  if (t.wind_speed > 35) {
    return {
      id,
      time: now,
      type: "warning",
      text: `⚠ 風速超過安全閾值 ${t.wind_speed} m/s，穩定性可能受影響。`,
    };
  }

  const messages = [
    `狀態：飛行穩定。座標 ${t.lat.toFixed(4)}, ${t.lng.toFixed(4)} 已同步。`,
    `遙測正常。高度 ${t.alt}m，航向 ${t.heading.toFixed(1)}°。`,
    `風力補償中。有效分速 ${t.effective_speed_m_min} m/min。飛行包線：穩定。`,
    `導航確認：航向 ${t.heading.toFixed(0)}°。航跡已確認。`,
  ];
  return {
    id,
    time: now,
    type: "status",
    text: messages[Math.floor(Math.random() * messages.length)],
  };
}

interface Props {
  telemetry: TelemetryPacket;
  isRunning: boolean;
  /** 是否有選中無人機且具遙測可取得診斷（未傳時沿用 isRunning） */
  canGetDiagnostic?: boolean;
  /** 隱藏標題列（用於嵌入浮動 dialog 時，標題已在 dialog header 顯示） */
  hideTitle?: boolean;
}

export default function AIDiagnosticPanel({ telemetry, isRunning, canGetDiagnostic, hideTitle }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const prevRef = useRef<TelemetryPacket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  const appendLog = useCallback((entry: Omit<LogEntry, "id" | "time">) => {
    const now = new Date().toLocaleTimeString("zh-TW", { hour12: false });
    setLogs((prev) => [
      ...prev.slice(-50),
      { ...entry, id: Date.now() + Math.random(), time: now },
    ]);
  }, []);

  const canDiagnose = canGetDiagnostic ?? isRunning;
  const handleDiagnose = useCallback(async () => {
    if (isDiagnosing || !canDiagnose) return;
    setIsDiagnosing(true);
    try {
      const data =
        telemetry.session_id != null
          ? await diagnoseSession(telemetry.session_id)
          : await diagnoseTelemetry([toSnapshot(telemetry)]);
      appendLog({ type: "diagnosis", text: data.diagnosis ?? "" });
    } catch (err) {
      const message =
        (err as ApiError).detail ?? (err instanceof Error ? err.message : String(err));
      appendLog({ type: "warning", text: `環境診斷請求失敗：${message}` });
    } finally {
      setIsDiagnosing(false);
    }
  }, [telemetry, canDiagnose, isDiagnosing, appendLog]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!isRunning) return;
    setLogs([
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString("zh-TW", { hour12: false }),
        type: "info",
        text: "AI 導航員上線。正在初始化飛行遙測分析…",
      },
    ]);
    tickRef.current = 0;
  }, [isRunning]);

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
          <PanelTitle as="h2">AI 導航員</PanelTitle>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1.5 text-xs leading-relaxed">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="shrink-0 font-mono text-subtle-foreground">{log.time}</span>
              <span
                className={`${colorMap[log.type]} ${log.type === "diagnosis" ? "whitespace-pre-wrap" : ""}`}
              >
                {log.text}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${isRunning ? "bg-success" : "bg-border-strong"}`} />
          <span className="text-xs text-muted-foreground">HEARTBEAT</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={!canDiagnose || isDiagnosing}
          onClick={handleDiagnose}
        >
          {isDiagnosing ? "診斷中…" : "取得環境診斷"}
        </Button>
      </div>
    </div>
  );
}
