/** Base API client: fetch wrapper with base URL and error handling. */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

if (import.meta.env.PROD && !API_BASE) {
  console.error(
    "[InsightAero] VITE_API_URL is not set. Set it at build time (e.g. in .env.production) so API requests target the correct backend."
  );
}

export function getApiBase(): string {
  return API_BASE;
}

export interface ApiError extends Error {
  status?: number;
  detail?: string;
  /**
   * True when the backend couldn't be reached: no response at all (server down,
   * offline, CORS) or a gateway error (the Vite dev proxy answers 502 when the
   * backend isn't running).
   */
  unreachable?: boolean;
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function isBackendUnreachable(error: unknown): boolean {
  return (error as ApiError | null)?.unreachable === true;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | undefined> }
): Promise<T> {
  const { params, ...init } = options ?? {};
  let url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const hasBody = init.body != null;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    const err: ApiError = new Error("Network error") as ApiError;
    err.unreachable = true;
    throw err;
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // ignore
    }
    const err: ApiError = new Error(detail ?? `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.detail = detail;
    err.unreachable = GATEWAY_STATUSES.has(res.status);
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
