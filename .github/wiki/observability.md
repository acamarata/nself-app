# Observability

ɳTasks uses `@nself/observability` for error reporting (Sentry) and distributed tracing (OTel).

## Setup

### Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN for error reporting. Obtain from the Sentry dashboard under project `ntask-mobile`. |
| `EXPO_PUBLIC_OTEL_ENDPOINT` | OpenTelemetry OTLP endpoint (optional). Leave unset to disable tracing. |
| `APP_ENV` | `development` or `production`. Controls trace sampling rate (0.2 in prod, 1.0 in dev). |
| `EXPO_PUBLIC_APP_VERSION` | App version string (e.g. `1.1.1`). Used to tag Sentry releases. |

Set these in your EAS `eas.json` per-environment or in a local `.env` for development.

### How It Works

Sentry init and OTel registration run at module level in `src/app/index.tsx` via `initObservability()` from `@nself/observability`, before the React tree mounts. This ensures errors thrown during hydration are captured.

```typescript
import * as SentryRN from '@sentry/react-native';
import { initObservability } from '@nself/observability';

initObservability({
  sentry: {
    sdk: SentryRN,
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    environment: process.env.APP_ENV ?? 'development',
    appKind: 'native',
    tracesSampleRate: process.env.APP_ENV === 'production' ? 0.2 : 1.0,
    release: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.1.1',
  },
  otel: process.env.EXPO_PUBLIC_OTEL_ENDPOINT
    ? { serviceName: 'ntask-mobile', endpoint: process.env.EXPO_PUBLIC_OTEL_ENDPOINT }
    : undefined,
});
```

The default export is wrapped with `SentryRN.wrap(App)` for native thread crash capture.

## PII Scrubbing

PII scrubbing is unconditional — `scrubEvent` from `@nself/observability/pii` runs as Sentry's `beforeSend` hook for every event. It strips:

- `user.email` → `[email]`
- `user.id` → `[uuid]`
- Email patterns anywhere in the payload
- UUID v4 patterns
- 10–16 digit token strings

No PII reaches the Sentry dashboard.

## Testing Errors

To verify events appear in Sentry (with no PII) in development:

```typescript
// In any screen, temporarily:
throw new Error('Test Sentry error');
```

Check the Sentry dashboard under the `ntask-mobile` project. Confirm the event has no `user.email` or `user.id` fields.
