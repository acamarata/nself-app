/**
 * App.tsx — Root router for task.nself.org SPA
 *
 * Purpose:    Define all client-side routes. task.nself.org IS the app — there is
 *               no /app subfolder in the URL structure. A single root-mounted
 *               AppShell (src/layouts/AppShell.tsx) decides per-route whether to
 *               render marketing chrome (Header/Footer, for logged-out-only pages
 *               like /, /login, /signup, /verify-email, /reset-password,
 *               /reset-confirm) or the authenticated task app chrome (sidebar +
 *               header). Legacy /app/* paths (old bookmarks/emails) permanently
 *               redirect to their root-level equivalent — never delete them.
 *               /welcome is the native-app splash (Welcome -> Login -> app);
 *               the Tauri desktop shell loads /welcome?app=desktop. AppShell
 *               suppresses ALL marketing chrome (Header/Footer/CookieBanner)
 *               whenever app-mode is detected (src/lib/app-mode.ts).
 * Inputs:     BrowserRouter from main.tsx
 * Outputs:    Route tree
 * Constraints: React Router v7; no SSR; SPA fallback via vercel.json
 * SOT:        T-P3-E3 — web/ntask Vite migration; D-S8-T1 — de-/app/ restructure
 */
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { AnalyticsProvider } from '@/components/AnalyticsProvider'
import { HomePage } from '@/pages/HomePage'
import { WelcomePage } from '@/pages/WelcomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/pages/app/LoginPage'
import { SignupPage } from '@/pages/app/SignupPage'
import { ListsPage } from '@/pages/app/ListsPage'
import { ListDetailPage } from '@/pages/app/ListDetailPage'
import { TodayPage } from '@/pages/app/TodayPage'
import { UpcomingPage } from '@/pages/app/UpcomingPage'
import { InboxPage } from '@/pages/app/InboxPage'
import { LogbookPage } from '@/pages/app/LogbookPage'
import { CalendarPage } from '@/pages/app/CalendarPage'
import { BoardPage } from '@/pages/app/BoardPage'
import { ProfilePage } from '@/pages/app/ProfilePage'
import { SettingsPage } from '@/pages/app/SettingsPage'
import { SearchPage } from '@/pages/app/SearchPage'
import { ResetPasswordPage } from '@/pages/app/ResetPasswordPage'
import { ResetConfirmPage } from '@/pages/app/ResetConfirmPage'
import { VerifyEmailPage } from '@/pages/app/VerifyEmailPage'
import { SentryTestPage } from '@/pages/SentryTestPage'
import { SharedListPage } from '@/pages/shared/SharedListPage'
import { HelpPage } from '@/pages/support/HelpPage'
import { ContactPage } from '@/pages/support/ContactPage'
import { AccessibilityPage } from '@/pages/support/AccessibilityPage'
import { SecurityPage } from '@/pages/support/SecurityPage'
import { AupPage } from '@/pages/legal/AupPage'
import { CookiesPage } from '@/pages/legal/CookiesPage'
import { PrivacyPage } from '@/pages/legal/PrivacyPage'
import { TermsPage } from '@/pages/legal/TermsPage'

/**
 * InviteAcceptPage — stores the invite token and redirects to /lists.
 *
 * Purpose:    Intercept /invite/:token, persist the token in sessionStorage
 *             so the ListsPage can surface an accept/decline banner on mount,
 *             then redirect immediately.
 * Inputs:     :token URL param
 * Outputs:    Navigation side-effect; renders a transient "Accepting…" indicator
 * Constraints: Must not flash content for more than one render tick.
 */
function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      sessionStorage.setItem('pendingInviteToken', token)
    }
    navigate('/lists', { replace: true, state: { pendingInvite: token } })
  }, [token, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950 text-sm text-gray-500 dark:text-gray-400">
      Accepting invitation…
    </div>
  )
}

/** Redirects /app/lists/:listId -> /lists/:listId, preserving the param. */
function LegacyListDetailRedirect() {
  const { listId } = useParams<{ listId: string }>()
  return <Navigate to={`/lists/${listId}`} replace />
}

/** Redirects /app/reset-confirm -> /reset-confirm, preserving the ?ticket= query string. */
function LegacyResetConfirmRedirect() {
  return <Navigate to={{ pathname: '/reset-confirm', search: window.location.search }} replace />
}

/** Redirects /app/invite/:token -> /invite/:token, preserving the token param. */
function LegacyInviteRedirect() {
  const { token } = useParams<{ token: string }>()
  return <Navigate to={`/invite/${token}`} replace />
}

/**
 * Root landing for auth redirects.
 *
 * hasura-auth finishes every emailed flow by redirecting the browser to
 * AUTH_CLIENT_URL — the bare origin — with ?refreshToken=<uuid>&type=<flow>.
 * It does NOT honour a per-request redirectTo unless that exact URL is listed in
 * AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS, which is empty in every environment,
 * so the reset link always lands here rather than on /reset-confirm.
 *
 * Without this, clicking "Reset password" in an email dropped the user on the
 * marketing home page with the token sitting unused in the query string, and
 * there was no way to finish setting a password.
 */
function RootLanding() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  const refreshToken = searchParams.get('refreshToken')

  if (type === 'passwordReset' && refreshToken) {
    return <Navigate to={{ pathname: '/reset-confirm', search: window.location.search }} replace />
  }
  return <HomePage />
}

export function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white antialiased">
      <Routes>
        {/* Root zone — AppShell renders marketing chrome or app chrome per-route/auth */}
        <Route path="/*" element={<AppShell />}>
          <Route index element={<RootLanding />} />
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="lists" element={<ListsPage />} />
          <Route path="lists/:listId" element={<ListDetailPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="upcoming" element={<UpcomingPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="logbook" element={<LogbookPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="reset-confirm" element={<ResetConfirmPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="invite/:token" element={<InviteAcceptPage />} />

          {/* Legacy /app/* redirects — permanent, client-side equivalent of a 301.
              Old bookmarks/emails may still point here; never delete these routes. */}
          <Route path="app" element={<Navigate to="/" replace />} />
          <Route path="app/login" element={<Navigate to="/login" replace />} />
          <Route path="app/signup" element={<Navigate to="/signup" replace />} />
          <Route path="app/lists" element={<Navigate to="/lists" replace />} />
          <Route path="app/lists/:listId" element={<LegacyListDetailRedirect />} />
          <Route path="app/today" element={<Navigate to="/today" replace />} />
          <Route path="app/upcoming" element={<Navigate to="/upcoming" replace />} />
          <Route path="app/inbox" element={<Navigate to="/inbox" replace />} />
          <Route path="app/logbook" element={<Navigate to="/logbook" replace />} />
          <Route path="app/calendar" element={<Navigate to="/calendar" replace />} />
          <Route path="app/board" element={<Navigate to="/board" replace />} />
          <Route path="app/profile" element={<Navigate to="/profile" replace />} />
          <Route path="app/settings" element={<Navigate to="/settings" replace />} />
          <Route path="app/search" element={<Navigate to="/search" replace />} />
          <Route path="app/reset-password" element={<Navigate to="/reset-password" replace />} />
          <Route path="app/reset-confirm" element={<LegacyResetConfirmRedirect />} />
          <Route path="app/verify-email" element={<Navigate to="/verify-email" replace />} />
          <Route path="app/invite/:token" element={<LegacyInviteRedirect />} />
          <Route path="app/*" element={<Navigate to="/" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Public shared-list view — no auth required */}
        <Route path="/shared/:token" element={<SharedListPage />} />

        {/* Support + legal pages (folded in from retired web/ntask-marketing, ADR-P6-04) */}
        <Route path="/help" element={<HelpPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/legal/aup" element={<AupPage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />

        {/* Observability smoke-test — dev-only; never index */}
        <Route path="/sentry-test" element={<SentryTestPage />} />
      </Routes>
      <AnalyticsProvider />
    </div>
  )
}
