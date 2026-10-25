/**
 * Environment variables in one place. Everything else imports from here
 * instead of reading `import.meta.env`, so the full list of settings (and
 * which are optional) is visible at a glance. See frontend/.env.example.
 */

const raw = import.meta.env;

const optional = (value: string | undefined): string | undefined =>
  value != null && value.trim() !== "" ? value.trim() : undefined;

/** Backend origin. Empty in dev, where Vite proxies /api and /ws to the backend. */
const apiUrl = optional(raw.VITE_API_URL) ?? "";

function telemetryWsUrl(): string {
  const explicit = optional(raw.VITE_WS_BASE_URL);
  if (explicit) return explicit;
  if (apiUrl) return `${apiUrl.replace(/^http/, "ws")}/ws/telemetry`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/telemetry`;
}

export const env = {
  isProd: raw.PROD,
  apiUrl,
  telemetryWsUrl: telemetryWsUrl(),
  /** Undefined when not set; the map and address search show a hint instead. */
  googleMapsApiKey: optional(raw.VITE_GOOGLE_MAPS_API_KEY),
} as const;
