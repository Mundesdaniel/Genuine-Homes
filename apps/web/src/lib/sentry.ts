/**
 * Error monitoring, opt-in via VITE_SENTRY_DSN at build time. The SDK is
 * dynamically imported so builds without a DSN ship zero Sentry bytes —
 * important for a low-data market.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        // Errors only for now — tracing/replay can be enabled later.
        tracesSampleRate: 0,
      });
    })
    .catch(() => {
      // Monitoring must never break the app.
    });
}
