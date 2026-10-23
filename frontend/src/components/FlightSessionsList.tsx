import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlightPathPoint } from "@/types/telemetry";
import {
  fetchFlightSessions,
  fetchSessionTelemetry,
  type FlightSessionItem,
} from "@/api/flightSessions";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";

interface Props {
  onSelectSession: (sessionId: number, path: FlightPathPoint[]) => void;
}

export default function FlightSessionsList({ onSelectSession }: Props) {
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
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>飛行場次</PanelTitle>
      </PanelHeader>
      <ScrollArea className="h-[200px]">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">載入中…</div>
        ) : sessions.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">尚無場次</div>
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
                  <span className="font-medium">{s.drone_name ?? `Session ${s.id}`}</span>
                  <span className="ml-2 text-muted-foreground">
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </Panel>
  );
}
