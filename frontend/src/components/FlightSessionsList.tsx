import { useRef, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlightPathPoint } from "@/types/telemetry";
import type { FlightSessionItem } from "@/api/flightSessions";
import { useFlightSessions, useLoadSessionPath } from "@/hooks/useFlightSessions";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatShortDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/errorMessage";
import { ListEmpty, ListError, ListLoading } from "@/components/ListState";

interface Props {
  onSelectSession: (sessionId: number, path: FlightPathPoint[]) => void;
  className?: string;
}

const SESSION_LIMIT = 30;

export default function FlightSessionsList({ onSelectSession, className }: Props) {
  const { t, i18n } = useTranslation();
  const { sessions, loading, refetching, loadError, refetch } = useFlightSessions({ limit: SESSION_LIMIT });
  const loadPath = useLoadSessionPath();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Only the most recent click may update the map, even if an earlier request finishes later.
  const latestRequest = useRef<number | null>(null);

  const handleClick = (session: FlightSessionItem) => {
    setSelectedId(session.id);
    latestRequest.current = session.id;
    loadPath(session)
      .then((path) => {
        if (latestRequest.current === session.id) onSelectSession(session.id, path);
      })
      .catch((error) => {
        if (latestRequest.current !== session.id) return;
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
          <ListError title={t("sessions.loadFailed")} error={loadError} onRetry={() => refetch()} retrying={refetching} />
        ) : sessions.length === 0 ? (
          <ListEmpty icon={<History aria-hidden />} title={t("sessions.empty")} description={t("sessions.emptyHint")} />
        ) : (
          <ul className="p-2 space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleClick(s)}
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
