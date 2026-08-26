/**
 * AppShell.tsx — Root layout for task.nself.org
 *
 * Purpose:    task.nself.org IS the app — mounted at root `/*`. Per-route, renders
 *             one of two chromes:
 *               1. Marketing chrome (Header/Footer/CookieBanner) for the public
 *                  pages: / (HomePage), /welcome, /login, /signup,
 *                  /verify-email, /reset-password, /reset-confirm — reachable
 *                  whether or not the visitor is authenticated (auth-aware
 *                  redirect happens on the index route itself, see
 *                  indexRedirectTarget below).
 *               2. Authenticated app chrome (sidebar + header + mobile nav) for
 *                  every other route (lists/today/upcoming/inbox/etc).
 *             Also runs the auth guard: unauthenticated visitors hitting an
 *             app-chrome route are redirected to /login.
 *
 *             App-mode (native desktop/mobile/TV shell, see src/lib/app-mode.ts):
 *             Header/Footer/CookieBanner are suppressed EVERYWHERE — a native
 *             shell must never show website chrome. `/` redirects straight to
 *             /lists (authenticated) or /welcome (logged out) instead of
 *             rendering the marketing HomePage, so the desktop window's flow
 *             is Welcome -> Login -> app, never a website landing page.
 * Inputs:     React Router Outlet
 * Outputs:    Marketing or full task-app layout with responsive sidebar, offline
 *             banner, modals
 * Constraints: React Router v7; useNavigate replaces useRouter; useLocation for pathname
 * SOT:        T-P3-E3 — web/ntask Vite migration; D-S8-T1 — de-/app/ restructure;
 *             desktop native-app-feel task — app-mode chrome suppression
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { Header, Footer, CookieBanner, Logo, ThemeToggle } from '@nself-web/ui'
import { isAppMode } from '@/lib/app-mode'
import { useAuth } from '@/lib/auth-context'
import { getLists, createList, type NpList } from '@/lib/graphql'
import { useAllTodos } from '@/hooks/useAllTodos'
import { Sidebar } from '@/components/tasks/Sidebar'
import { NewListModal } from '@/components/tasks/NewListModal'
import { OfflineBanner } from '@/components/tasks/OfflineBanner'
import { InstallPrompt } from '@/components/InstallPrompt'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { ShortcutReferenceModal } from '@/components/ui/ShortcutReferenceModal'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { NotificationCenterPopover } from '@/components/notifications/NotificationCenterPopover'
import { InviteBanner } from '@/components/collaboration/InviteBanner'

// Public pages: reachable logged-out, rendered with marketing chrome (not the app sidebar shell).
const PUBLIC_PATHS = ['/', '/welcome', '/login', '/signup', '/verify-email', '/reset-password', '/reset-confirm']

// Authenticated app routes: the only paths that should force an unauthenticated
// visitor to /login. Anything NOT in this list and NOT in PUBLIC_PATHS is an
// unrecognized route — let it fall through to the `*` NotFoundPage route
// instead of redirecting, otherwise 404s are unreachable for logged-out users.
const PROTECTED_PATHS = [
  '/lists',
  '/today',
  '/upcoming',
  '/inbox',
  '/logbook',
  '/calendar',
  '/board',
  '/profile',
  '/settings',
  '/search',
]
const isProtectedPath = (pathname: string) =>
  PROTECTED_PATHS.includes(pathname) || pathname.startsWith('/lists/') || pathname.startsWith('/invite/')

export function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, loading, signOut: authSignOut } = useAuth()
  const { todos: sidebarTodos } = useAllTodos()
  const [lists, setLists] = useState<NpList[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcutRef, setShowShortcutRef] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)

  const shortcuts = useMemo(
    () => ({
      c: () => setShowCreateTask(true),
      l: () => setShowNewList(true),
      '?': () => setShowShortcutRef(true),
      'cmd+k': () => setShowCommandPalette(true),
    }),
    []
  )

  useKeyboardShortcuts(shortcuts)

  // Computed once per render — isAppMode() reads the URL/localStorage/UA, all
  // stable for the lifetime of a desktop window session.
  const appMode = isAppMode()
  const isPublicPath = PUBLIC_PATHS.includes(pathname)
  // Unrecognized routes (404s) render with the same marketing chrome as public
  // pages when logged out — there is no sidebar/list data to show around a
  // "page not found" message. Logged-in users keep their normal app chrome.
  const isMarketingChrome = isPublicPath || (!user && !isProtectedPath(pathname))

  const fetchLists = useCallback(async () => {
    const result = await getLists()
    setLists(result)
  }, [])

  useEffect(() => {
    if (loading) return
    if (user && !isPublicPath) {
      void fetchLists()
    } else if (!user && !isPublicPath && isProtectedPath(pathname)) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, isPublicPath, pathname, navigate, fetchLists])

  // `/` is dual-purpose: authenticated visitors skip the marketing landing and
  // go straight into the app (task.nself.org IS the app). Logged-out visitors
  // see the marketing HomePage. This is the only auth-aware redirect on a
  // public path — keep it here, not duplicated in HomePage.
  //
  // In app-mode (native desktop/mobile/TV shell) `/` never renders the
  // marketing HomePage at all — it redirects straight to /lists when
  // authenticated, or /welcome (the native splash) when logged out. The
  // shell's flow is always Welcome -> Login -> app, never a website landing.
  useEffect(() => {
    if (loading) return
    if (pathname !== '/') return
    if (user) {
      navigate('/lists', { replace: true })
    } else if (appMode) {
      navigate('/welcome', { replace: true })
    }
  }, [pathname, user, loading, navigate, appMode])

  async function handleSignOut() {
    await authSignOut()
    navigate('/login', { replace: true })
  }

  async function handleCreateList(title: string, color: string, icon: string) {
    const result = await createList({ title, color, icon })
    if (!result) throw new Error('Failed to create list')
    const refreshed = await getLists()
    setLists(refreshed)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (isMarketingChrome) {
    // App-mode (native desktop/mobile/TV shell): render ONLY the page itself —
    // no marketing Header, no Footer, no CookieBanner. A native shell must
    // never show website chrome, ever.
    if (appMode) {
      return (
        <main id="main-content" className="flex-1 min-h-screen" tabIndex={-1}>
          <Outlet />
        </main>
      )
    }

    return (
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          Skip to main content
        </a>
        <Header
          logo={<Logo className="h-8 w-auto" product="Task" />}
          logoHref="/"
          // The Logo SVG is aria-hidden, so the brand link's accessible name
          // comes entirely from this label. Without it the shared component
          // defaults to "ɳSelf home" and a screen reader on task.nself.org
          // announces the wrong product.
          brandLabel="ɳTask home"
          githubUrl="https://github.com/nself-org/ntask"
          chatUrl={null}
          navItems={[
            { label: 'nself.org', href: 'https://nself.org', external: true },
          ]}
          accountButton={
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="hidden sm:inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                Log in
              </a>
              <a
                href="/signup"
                className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 transition-colors"
              >
                Sign up free
              </a>
            </div>
          }
        />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          <Outlet />
        </main>
        <Footer
          copyrightText="© {year} ɳTask · part of the ɳSelf ecosystem · MIT licensed"
          logoHref="/"
          brandLabel="ɳTask home"
        />
        <CookieBanner />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Pending invite banners */}
      <InviteBanner />

      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 px-4 h-14">
        <button
          className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <span className="text-base font-bold text-gray-900 dark:text-white flex-1">ɳTask</span>

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user && <NotificationCenterPopover userId={user.id} />}
          <Link
            to="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <span className="text-xs font-medium text-brand-primary dark:text-brand-muted">
                {(user?.displayName || user?.email || '?')[0].toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block truncate max-w-[120px]">
              {user?.displayName || user?.email}
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            aria-label="Sign out"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 overflow-y-auto flex-shrink-0">
          <Sidebar lists={lists} todos={sidebarTodos} onNewList={() => setShowNewList(true)} />
        </aside>

        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-gray-900 shadow-xl lg:hidden">
              <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 dark:border-gray-700/50">
                <span className="font-bold text-gray-900 dark:text-white">ɳTask</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <Sidebar
                lists={lists}
                todos={sidebarTodos}
                onNewList={() => {
                  setShowNewList(true)
                  setSidebarOpen(false)
                }}
              />
            </aside>
          </>
        )}

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900">
        <Link
          to="/lists"
          className={clsx(
            'flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors',
            pathname.startsWith('/lists') ? 'text-brand-primary' : 'text-gray-500',
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5">
            <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="11" width="8" height="2" rx="1" fill="currentColor" />
          </svg>
          Lists
        </Link>
        <button
          onClick={() => setShowNewList(true)}
          className="flex-1 flex flex-col items-center py-2 text-xs gap-1 text-gray-500 hover:text-brand-primary transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New
        </button>
        <Link
          to="/profile"
          className={clsx(
            'flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors',
            pathname === '/profile' ? 'text-brand-primary' : 'text-gray-500',
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Profile
        </Link>
      </nav>

      {showNewList && (
        <NewListModal onClose={() => setShowNewList(false)} onCreate={handleCreateList} />
      )}

      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onNewTask={() => { setShowCommandPalette(false); setShowCreateTask(true) }}
          onNewList={() => { setShowCommandPalette(false); setShowNewList(true) }}
        />
      )}

      {showShortcutRef && (
        <ShortcutReferenceModal onClose={() => setShowShortcutRef(false)} />
      )}

      {showCreateTask && (
        <CreateTaskDialog
          onCreated={() => setShowCreateTask(false)}
          onClose={() => setShowCreateTask(false)}
        />
      )}

      <OfflineBanner onSync={fetchLists} />
      <InstallPrompt />
    </div>
  )
}
