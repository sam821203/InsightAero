import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TelemetryPacket } from "@/types/telemetry";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { queryKeys } from "@/api/query-keys";
import { env } from "@/config/env";

const WS_URL = env.telemetryWsUrl;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/* requestAnimationFrame doesn't run in background tabs; flush on a timer there. */
const HIDDEN_FLUSH_MS = 500;

type ServerMessage = TelemetryPacket & { event?: string; task_id?: number };

/**
 * Opens the telemetry WebSocket and writes packets into the telemetry store.
 *
 * - Subscribes to nothing, so the component that calls it does not re-render
 *   on each packet; components read what they need with selectors.
 * - Batches packets per animation frame. The backend sends one packet per
 *   drone per tick, so several arrive together; one store update per frame
 *   means one map render instead of one per drone.
 * - Reconnects with exponential backoff when the connection drops.
 */
export function useTelemetryConnection() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { ingest, setConnection, clearPathsAndIdle } = useTelemetryStore.getState();
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let disposed = false;
    let queue: TelemetryPacket[] = [];
    let flushScheduled = false;

    const flush = () => {
      flushScheduled = false;
      const batch = queue;
      queue = [];
      ingest(batch);
    };

    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      if (document.visibilityState === "hidden") {
        window.setTimeout(flush, HIDDEN_FLUSH_MS);
      } else {
        requestAnimationFrame(flush);
      }
    };

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        attempt = 0;
        setConnection("open");
      };

      socket.onmessage = (event) => {
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (data.event === "arrived") {
          // Apply queued packets first so they don't re-add a trail after clearing.
          if (queue.length > 0) flush();
          clearPathsAndIdle();
          if (typeof data.task_id === "number") {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
          }
          return;
        }
        queue.push(data);
        scheduleFlush();
      };

      socket.onclose = () => {
        if (disposed) return;
        setConnection("reconnecting");
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      queue = [];
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [queryClient]);
}
