'use client'

import { useEffect, useState } from 'react'
import { offlineQueue } from '@/lib/offline-queue'
import { useT } from '@/lib/i18n'

interface OfflineBannerProps {
  /** Called when back online — lets parent reload data after sync */
  onSync?: () => void
}

/**
 * OfflineBanner
 *
 * Shows a banner when the user is offline. When reconnected, drains the
 * IndexedDB mutation queue and calls onSync() so the parent can reload.
 *
 * WCAG: role="status" + aria-live="polite" so screen readers announce the
 * offline/online state change without forcing focus.
 */
export function OfflineBanner({ onSync }: OfflineBannerProps) {
  const t = useT('common')
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Read initial state after mount (window is available)
    setOnline(navigator.onLine)

    async function updatePending() {
      const count = await offlineQueue.size()
      setPendingCount(count)
    }

    function handleOffline() {
      setOnline(false)
      updatePending()
    }

    async function handleOnline() {
      setOnline(true)
      const count = await offlineQueue.size()
      if (count === 0) return

      setSyncing(true)
      await offlineQueue.drain()
      setSyncing(false)
      setPendingCount(0)
      onSync?.()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    updatePending()

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [onSync])

  if (online && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-16 lg:bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-800/50 dark:bg-amber-900/30"
    >
      {online ? (
        <>
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" aria-hidden="true" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            {syncing
              ? t('offline.syncing')
              : `${pendingCount} ${pendingCount !== 1 ? t('offline.changesSynced') : t('offline.changeSynced')}`}
          </p>
        </>
      ) : (
        <>
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('offline.title')}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('offline.savedLocally')}
              {pendingCount > 0 && ` (${pendingCount} ${t('offline.pending')})`}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
