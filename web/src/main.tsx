/**
 * main.tsx — React SPA entry point for task.nself.org
 *
 * Purpose:    Mount the React app with React Router + ThemeProvider.
 *             Sets html[lang] and html[dir] for RTL locale support (Arabic etc).
 *             Initialises Sentry error reporting + OTel tracing via @nself/observability.
 * Inputs:     #root DOM element; persisted locale (SettingsPage → Language tab)
 *             or navigator.language for locale detection
 * Outputs:    Rendered React application; Sentry + OTel active when DSN is set.
 * Constraints: SPA; Vite; React 19; React Router v7
 *   - RTL is CSS-driven (dir attribute + Tailwind rtl: variants), not conditional rendering
 *   - Sentry DSN from VITE_SENTRY_DSN (set from SENTRY_DSN_NTASK in vault.env)
 *   - PII scrubbing via scrubEvent strips email, userId, and digit tokens
 * SOT:        T-P3-E6-W1-S3-T01 — RTL layout support (Vite SPA surfaces)
 * SPORT:      T-P3-E6-W2-S1-T01 — observability wiring
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import * as Sentry from '@sentry/react'
import { scrubEvent, initObservability } from '@nself/observability'
import { NselfI18nProvider } from '@nself/i18n'
import { initLocale, getPreferredLocale, type Locale } from './lib/i18n'
import { AuthProvider } from './lib/auth-context'
import { App } from './App'
import '@/styles/tailwind.css'

/** RTL locales — dir="rtl" is applied for these base locale codes */
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur'])

// ─── Observability (Sentry + OTel) ───────────────────────────────────────────
// DSN: VITE_SENTRY_DSN in .env.local (set from SENTRY_DSN_NTASK in vault.env).
initObservability({
  sentry: {
    sdk: Sentry,
    dsn: import.meta.env['VITE_SENTRY_DSN'] ?? '',
    environment: import.meta.env['VITE_ENV'] ?? 'production',
    release: import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
    appKind: 'web',
    tracesSampleRate: 0.1,
  },
  otel: {
    serviceName: 'ntask-web',
    endpoint: import.meta.env['VITE_OTEL_ENDPOINT'],
  },
})

// PII scrubber: register as an event processor so all events are scrubbed
// before upload (strips email addresses, UUIDs, and digit-token strings).
if (import.meta.env['VITE_SENTRY_DSN']) {
  Sentry.addEventProcessor((event) => scrubEvent(event as Record<string, unknown>) as typeof event)
}

// Locale resolution: an explicit choice made in Settings → Language wins
// (persisted in localStorage — see lib/i18n.ts setPreferredLocale), otherwise
// fall back to the browser's Accept-Language primary subtag, then 'en'.
const detectedLocale = getPreferredLocale() ?? ((navigator.language ?? 'en').split('-')[0] || 'en')

// Preload all namespaces for non-English locales before React renders.
// Fire-and-forget — component-level useT() falls back to 'en' if not yet loaded.
void initLocale(detectedLocale as Locale)

// Apply lang + dir to the HTML root immediately (before React hydrates)
// so there is no layout flash for RTL users.
document.documentElement.lang = detectedLocale
document.documentElement.dir = RTL_LOCALES.has(detectedLocale) ? 'rtl' : 'ltr'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <NselfI18nProvider locale={detectedLocale as Parameters<typeof NselfI18nProvider>[0]['locale']}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" storageKey="nself_theme" disableTransitionOnChange>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </NselfI18nProvider>
  </StrictMode>,
)
