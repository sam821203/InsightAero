/**
 * Query keys in one place, so invalidation always matches what was fetched.
 * Each group starts with a fixed root, so `invalidateQueries({ queryKey: queryKeys.drones.all })`
 * covers every drone query regardless of params.
 */
export const queryKeys = {
  tasks: {
    all: ["tasks"] as const,
    list: (params: { limit?: number }) => ["tasks", "list", params] as const,
    detail: (taskId: number) => ["tasks", "detail", taskId] as const,
    report: (taskId: number) => ["tasks", "report", taskId] as const,
  },
  drones: {
    all: ["drones"] as const,
  },
  flightSessions: {
    all: ["flight-sessions"] as const,
    list: (params: { limit?: number }) => ["flight-sessions", "list", params] as const,
    path: (sessionId: number) => ["flight-sessions", "path", sessionId] as const,
  },
};
