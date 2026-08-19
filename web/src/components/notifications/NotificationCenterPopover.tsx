/**
 * NotificationCenterPopover.tsx — Bell icon with unread badge + popover notification list
 *
 * Purpose:    Show real-time unread notification count on a bell button; open a popover
 *             with a scrollable list of recent notifications. Marks individual or all
 *             notifications read; navigates to action_url on row click.
 * Inputs:     userId — Hasura UUID of the authenticated user
 * Outputs:    Bell button (with live badge) + absolute-positioned popover dialog
 * Constraints: Popover closes on outside click or Escape key. Badge hidden when count=0.
 *              Count capped at "99+". List fetched on open; subscription keeps it live.
 *              WCAG: aria-label on button, role="dialog" + aria-label on popover.
 *              No external UI lib — plain CSS positioning + Tailwind.
 * SPORT:      T-P5-E1-notifications
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SUBSCRIBE_UNREAD_NOTIFICATION_COUNT,
  SUBSCRIBE_NOTIFICATIONS,
} from '@nself/ntask-core'
import type { NpNotification } from '@nself/ntask-core'
import { useSubscription } from '@/hooks/useSubscription'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/graphql-collab'
import { useT } from '@/lib/i18n'

interface UnreadCountData {
  np_notifications_aggregate: {
    aggregate: { count: number }
  }
}

interface NotificationsSubData {
  np_notifications: Array<Pick<NpNotification, 'id' | 'type' | 'title' | 'body' | 'read' | 'created_at'>>
}

interface NotificationCenterPopoverProps {
  userId: string
}

const NOTIFICATION_FETCH_LIMIT = 20

/** Icon color by notification type */
function typeColor(type: NpNotification['type']): string {
  switch (type) {
    case 'due_reminder':
    case 'evening_reminder':
    case 'location_reminder':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
    case 'shared_list':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
    case 'list_update':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'new_todo':
    default:
      return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  }
}

/** Emoji glyph by notification type */
function typeGlyph(type: NpNotification['type']): string {
  if (type === 'shared_list') return '🔗'
  if (type === 'list_update') return '✏️'
  if (type.includes('reminder')) return '⏰'
  return '✓'
}

function relativeTime(iso: string, t: (key: string) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return t('notifications.justNow')
  if (mins < 60) return t('notifications.minutesAgo').replace('{{n}}', String(mins))
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('notifications.hoursAgo').replace('{{n}}', String(hrs))
  return t('notifications.daysAgo').replace('{{n}}', String(Math.floor(hrs / 24)))
}

function badgeLabel(count: number): string { return count > 99 ? '99+' : String(count) }

export function NotificationCenterPopover({ userId }: NotificationCenterPopoverProps) {
  const t = useT('tasks')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NpNotification[]>([])
  const [fetching, setFetching] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { data: countData } = useSubscription<UnreadCountData>(
    SUBSCRIBE_UNREAD_NOTIFICATION_COUNT,
    { userId },
    { enabled: !!userId },
  )
  const unreadCount = countData?.np_notifications_aggregate?.aggregate?.count ?? 0

  // Live subscription keeps list fresh after initial fetch
  const { data: subNotifs } = useSubscription<NotificationsSubData>(
    SUBSCRIBE_NOTIFICATIONS,
    { userId, limit: NOTIFICATION_FETCH_LIMIT },
    { enabled: open && !!userId },
  )

  useEffect(() => {
    if (subNotifs?.np_notifications) {
      setNotifications((prev) => {
        const incoming = subNotifs.np_notifications as NpNotification[]
        // Merge: subscription result is the authoritative ordered list
        return incoming.length > 0 ? incoming : prev
      })
    }
  }, [subNotifs])

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    try {
      const result = await getNotifications(userId, NOTIFICATION_FETCH_LIMIT)
      if (result) setNotifications(result)
    } finally {
      setFetching(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) void fetchNotifications()
  }, [open, fetchNotifications])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function handleRowClick(notif: NpNotification) {
    if (!notif.read) {
      await markNotificationRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      )
    }
    if (notif.action_url) {
      setOpen(false)
      navigate(notif.action_url)
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.bell')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        {/* Bell icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-live="polite"
            aria-label={t('notifications.unreadCount').replace('{{count}}', String(unreadCount))}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white"
          >
            {badgeLabel(unreadCount)}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('notifications.panelLabel')}
          className={[
            'absolute right-0 top-10 z-50',
            'w-80 rounded-xl border border-gray-200 dark:border-gray-700/60',
            'bg-white dark:bg-gray-900 shadow-xl',
            'overflow-hidden',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('notifications.title')}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <ul
            role="list"
            className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800"
          >
            {fetching && notifications.length === 0 ? (
              <li className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </li>
            ) : notifications.length === 0 ? (
              <li className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <span className="mb-1 text-2xl" aria-hidden="true">🎉</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('notifications.empty')}
                </p>
              </li>
            ) : (
              notifications.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => void handleRowClick(notif)}
                    className={[
                      'flex w-full items-start gap-3 px-4 py-3 text-left',
                      'hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors',
                      !notif.read
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : '',
                    ].join(' ')}
                  >
                    {/* Type icon */}
                    <span
                      className={[
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm',
                        typeColor(notif.type),
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {typeGlyph(notif.type)}
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {notif.title}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {notif.body}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {relativeTime(notif.created_at, t)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
