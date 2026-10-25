import { useState } from "react";
import { Bot, BrainCircuit, X } from "lucide-react";
import type { TelemetryPacket } from "@/types/telemetry";
import AIDiagnosticPanel from "@/components/AIDiagnosticPanel";
import { PanelTitle } from "@/components/ui/panel";
import { useTranslation } from "react-i18next";

interface Props {
  telemetry: TelemetryPacket;
  isRunning: boolean;
  /** 是否有選中無人機且具遙測，可取得診斷（未傳時沿用 isRunning） */
  canGetDiagnostic?: boolean;
}

export default function AIFloatingNavigator({ telemetry, isRunning, canGetDiagnostic }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded((prev) => !prev);

  return (
    <div className="absolute left-8 bottom-14 z-10 flex flex-col items-start gap-2">
      {expanded && (
        <div
          className="flex w-[340px] max-h-[60vh] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-overlay"
          role="dialog"
          aria-label={t("ai.title")}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 shrink-0 text-subtle-foreground" />
              <PanelTitle as="h2">{t("ai.title")}</PanelTitle>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("ai.close")}
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-popover text-foreground shadow-raised transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={expanded ? t("ai.close") : t("ai.open")}
        aria-expanded={expanded}
      >
        <Bot className="h-5 w-5" />
      </button>
    </div>
  );
}
