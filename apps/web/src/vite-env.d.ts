/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Genuine Homes API. Defaults to `/api` (dev proxy). */
  readonly VITE_API_URL?: string;
  /** Sentry DSN for the web app. Unset → Sentry never loads (code-split). */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
