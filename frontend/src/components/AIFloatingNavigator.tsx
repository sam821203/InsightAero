import { useState } from "react";
import { Bot, BrainCircuit, X } from "lucide-react";
import type { TelemetryPacket } from "@/types/telemetry";
import AIDiagnosticPanel from "@/components/AIDiagnosticPanel";

interface Props {
  telemetry: TelemetryPacket;
  isRunning: boolean;
  /** 是否有選中無人機且具遙測，可取得診斷（未傳時沿用 isRunning） */
  canGetDiagnostic?: boolean;
}

export default function AIFloatingNavigator({ telemetry, isRunning, canGetDiagnostic }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded((prev) => !prev);

  return (
    <div className="absolute left-8 bottom-14 z-10 flex flex-col items-start gap-2">
      {expanded && (
        <div
          className="flex w-[340px] max-h-[60vh] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          role="dialog"
          aria-label="AI 導航員診斷"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="font-display text-xs uppercase tracking-widest text-primary">
                AI 導航員
              </h2>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="關閉 AI 導航員診斷"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AIDiagnosticPanel telemetry={telemetry} isRunning={isRunning} canGetDiagnostic={canGetDiagnostic} hideTitle />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md transition-colors hover:bg-card hover:border-primary hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={expanded ? "關閉 AI 導航員診斷" : "開啟 AI 導航員診斷"}
        aria-expanded={expanded}
      >
        <Bot className="h-5 w-5" />
      </button>
    </div>
  );
}
