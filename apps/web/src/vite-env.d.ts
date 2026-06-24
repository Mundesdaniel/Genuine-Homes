/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Genuine Homes API. Defaults to `/api` (dev proxy). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
