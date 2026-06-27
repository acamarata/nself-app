// Purpose: Shared Sentry client for all backend functions
// Inputs: SENTRY_DSN_BACKEND env var (optional — if absent, Sentry is a no-op)
// Outputs: Sentry singleton ready for captureException + flush
// Constraints: Must call Sentry.flush() before handler return in serverless context
// SPORT: F08 backend functions observability

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN_BACKEND;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
