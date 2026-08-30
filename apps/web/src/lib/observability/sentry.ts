/**
 * Error reporting, when a DSN is configured.
 *
 * Loaded lazily and only in the browser. Without a DSN nothing is imported and
 * nothing is sent, which is the state a fresh clone and every CI run is in.
 */
let started = false;

export async function startErrorReporting(): Promise<void> {
  if (started) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return;

  started = true;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    // A racing game at sixty frames a second produces a lot of traces. A tenth
    // is plenty to spot a regression and does not flood the quota in an hour.
    tracesSampleRate: 0.1,
    // Never record what people type or say to each other.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      // Strip anything identifying beyond the platform's own id. Spec v2
      // section 76 and 80: no secrets, no unnecessary personal data.
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}
