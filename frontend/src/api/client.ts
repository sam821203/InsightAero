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
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
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
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
