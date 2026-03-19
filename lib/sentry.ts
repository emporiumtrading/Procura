/**
 * Sentry error reporting - no-op when VITE_SENTRY_DSN is not set.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn && typeof dsn === 'string' && dsn.startsWith('https://')) {
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
