import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
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
import { errorMessage } from "@/lib/errorMessage";
import { ListEmpty, ListError, ListLoading } from "@/components/ListState";

interface Props {
  onSelectSession: (sessionId: number, path: FlightPathPoint[]) => void;
  className?: string;
}

export default function FlightSessionsList({ onSelectSession, className }: Props) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<FlightSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback((isCancelled: () => boolean = () => false) => {
    setLoading(true);
    fetchFlightSessions({ limit: 30 })
      .then((data) => {
        if (isCancelled()) return;
        setSessions(data);
        setLoadError(null);
      })
      .catch((error) => {
        if (!isCancelled()) setLoadError(error);
      })
      .finally(() => {
        if (!isCancelled()) setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleClick = (sessionId: number) => {
    setSelectedId(sessionId);
    fetchSessionTelemetry(sessionId, { limit: 2000 })
      .then((rows) => {
        const path: FlightPathPoint[] = rows.map((p) => ({ lat: p.lat, lng: p.lng }));
        onSelectSession(sessionId, path);
      })
      .catch((error) => {
        setSelectedId(null);
        toast.error(t("sessions.pathFailed"), { description: errorMessage(error, t) });
      });
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return formatShortDateTime(iso, i18n.language);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {sessions.length > 0 && (
        <p className="border-b border-border-subtle px-3 py-2.5 text-xs text-muted-foreground">
          {t("sessions.hint")}
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {sessions.length === 0 && loading ? (
          <ListLoading />
        ) : sessions.length === 0 && loadError != null ? (
          <ListError title={t("sessions.loadFailed")} error={loadError} onRetry={() => load()} retrying={loading} />
        ) : sessions.length === 0 ? (
          <ListEmpty icon={<History aria-hidden />} title={t("sessions.empty")} description={t("sessions.emptyHint")} />
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
