/// <reference types="vite/client" />

/* All optional: read them through src/config/env.ts, which handles missing values. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
