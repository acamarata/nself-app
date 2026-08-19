/**
 * Sidebar.tsx — ɳTask navigation sidebar
 *
 * Purpose:    Renders the persistent left sidebar with cross-list view links
 *             (Today/Upcoming/Inbox/Calendar/Board/Logbook) followed by the
 *             per-list navigation. Highlights the currently active route.
 * Inputs:     lists: NpList[], onNewList: () => void
 * Outputs:    Sidebar with view links + list links, active state highlighting
 * Constraints: Must update active state on route change without full re-render.
 *              View counts are computed from an optional lightweight todos
 *              array — cheap (already in memory client-side), never a
 *              separate fetch.
 */
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useMemo } from 'react'
import type { NpList, NpTask } from '@/lib/graphql'
import { getOverdueTodos, getTodayTodos, getInboxTodos } from '@/lib/task-date-groups'
import { SavedViewsList } from './SavedViewsList'

interface SidebarProps {
  lists: NpList[]
  onNewList: () => void
  /** Optional cross-list todos for cheap view counts (Today/Inbox). Omit to hide counts. */
  todos?: NpTask[]
}

interface ViewLink {
  to: string
  label: string
  icon: React.ReactNode
  count?: number
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 flex-shrink-0">
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Sidebar({ lists, onNewList, todos }: SidebarProps) {
  const { pathname } = useLocation()

  const defaultList = useMemo(() => lists.find((l) => l.is_default) ?? null, [lists])

  const todayCount = useMemo(() => {
    if (!todos) return undefined
    return getOverdueTodos(todos).length + getTodayTodos(todos).length
  }, [todos])

  const inboxCount = useMemo(() => {
    if (!todos) return undefined
    return getInboxTodos(todos.filter((t) => !t.completed), defaultList?.id ?? null).length
  }, [todos, defaultList])

  const viewLinks: ViewLink[] = [
    { to: '/today', label: 'Today', icon: <NavIcon path="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M11.8 4.2l-1.4 1.4M5.6 10.4l-1.4 1.4" />, count: todayCount },
    { to: '/upcoming', label: 'Upcoming', icon: <NavIcon path="M3 3h10v10H3V3zM3 6h10M6 2v2M10 2v2" /> },
    { to: '/inbox', label: 'Inbox', icon: <NavIcon path="M2 8l2.5 4h7L14 8M2 8V4h12v4M2 8l2.5-4M14 8l-2.5-4" />, count: inboxCount },
    { to: '/calendar', label: 'Calendar', icon: <NavIcon path="M3 3h10v10H3V3zM3 6h10M5.5 2v2M10.5 2v2" /> },
    { to: '/board', label: 'Board', icon: <NavIcon path="M2 3h4v10H2V3zM7 3h3v6H7V3zM12 3h2v4h-2V3z" /> },
    { to: '/logbook', label: 'Logbook', icon: <NavIcon path="M4 2h6l2 2v10H4V2zM10 2v2h2M5 8h6M5 10.5h6" /> },
  ]

  return (
    <nav className="flex flex-col h-full">
      <div className="py-2 border-b border-gray-100 dark:border-gray-800">
        {viewLinks.map((view) => {
          const isActive = pathname === view.to
          return (
            <Link
              key={view.to}
              to={view.to}
              className={clsx(
                'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sky-50 dark:bg-indigo-900/20 text-brand-primary dark:text-brand-muted font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              {view.icon}
              <span className="flex-1">{view.label}</span>
              {view.count !== undefined && view.count > 0 && (
                <span className="text-xs text-gray-400 tabular-nums">{view.count}</span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Lists</span>
        <button
          onClick={onNewList}
          className="h-6 w-6 rounded-md flex items-center justify-center text-gray-400 hover:text-brand-primary hover:bg-sky-50 dark:hover:bg-indigo-900/20 transition-colors"
          aria-label="New list"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <Link
          to="/lists"
          className={clsx(
            'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
            pathname === '/lists'
              ? 'bg-sky-50 dark:bg-indigo-900/20 text-brand-primary dark:text-brand-muted font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 flex-shrink-0">
            <rect x="2" y="3" width="12" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="11" width="8" height="2" rx="1" fill="currentColor" />
          </svg>
          All Lists
        </Link>

        {lists.map((list) => {
          const isActive = pathname === `/lists/${list.id}`
          const color = list.color || '#6366f1'
          return (
            <Link
              key={list.id}
              to={`/lists/${list.id}`}
              className={clsx(
                'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sky-50 dark:bg-indigo-900/20 text-brand-primary dark:text-brand-muted font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <span
                className="flex-shrink-0 h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{list.title}</span>
            </Link>
          )
        })}
      </div>

      <SavedViewsList />
    </nav>
  )
}
