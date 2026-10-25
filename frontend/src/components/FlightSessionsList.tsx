import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlightPathPoint } from "@/types/telemetry";
import {
  fetchFlightSessions,
  fetchSessionTelemetry,
  type FlightSessionItem,
} from "@/api/flightSessions";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatShortDateTime } from "@/lib/format";

interface Props {
  onSelectSession: (sessionId: number, path: FlightPathPoint[]) => void;
  className?: string;
}

export default function FlightSessionsList({ onSelectSession, className }: Props) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<FlightSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFlightSessions({ limit: 30 })
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = (sessionId: number) => {
    setSelectedId(sessionId);
    fetchSessionTelemetry(sessionId, { limit: 2000 })
      .then((rows) => {
        const path: FlightPathPoint[] = rows.map((p) => ({ lat: p.lat, lng: p.lng }));
        onSelectSession(sessionId, path);
      })
      .catch(() => {});
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return formatShortDateTime(iso, i18n.language);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <p className="border-b border-border-subtle px-3 py-2.5 text-xs text-muted-foreground">
        {t("sessions.hint")}
      </p>
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">{t("common.loading")}</div>
        ) : sessions.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">{t("sessions.empty")}</div>
        ) : (
          <ul className="p-2 space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleClick(s.id)}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                    selectedId === s.id
                      ? "bg-surface-selected text-interactive-text"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{s.drone_name ?? t("sessions.fallbackName", { id: s.id })}</span>
                  <span className="ml-2 text-muted-foreground">
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
