/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Genuine Homes API. Defaults to `/api` (dev proxy). */
  readonly VITE_API_URL?: string;
  /** Sentry DSN for the web app. Unset → Sentry never loads (code-split). */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * Prototype/demo mode. `"true"` runs the identity-verification flow entirely
   * in the browser (no API) so it's clickable on a static deploy. Unset in real
   * deployments.
   */
  readonly VITE_PROTOTYPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
