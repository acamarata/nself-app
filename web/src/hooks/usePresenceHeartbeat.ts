/**
 * usePresenceHeartbeat.ts — Periodic presence ping for a shared list
 * Purpose:     While the user is actively viewing a list and the tab is visible,
 *              sends a presence upsert every 30 seconds so other collaborators
 *              see them as online. Cleans up on unmount or when disabled.
 * Inputs:      listId — list to send presence for.
 *              enabled — set false to pause (e.g. when list is not open).
 * Outputs:     void — side-effect only hook.
 * Constraints: Pauses when document.visibilityState === 'hidden' to avoid
 *              burning server ops while the tab is backgrounded.
 *              Sends an immediate ping on enable, then every 30 s.
 *              Calls removePresence on cleanup (unmount / enabled→false).
 *              TS strict — no `any`.
 * SPORT:       P5-W1-collab-presence-heartbeat
 */

import { useEffect, useRef } from 'react'
import { upsertPresence, removePresence } from '@/lib/graphql-collab'

const HEARTBEAT_MS = 30_000

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePresenceHeartbeat(listId: string, enabled: boolean): void {
  // Track the interval id so we can clear it in cleanup.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track the current listId in a ref so the visibility listener can access it
  // without being re-registered on every listId change.
  const listIdRef = useRef(listId)
  listIdRef.current = listId

  // Whether the tab is currently visible.
  const visibleRef = useRef(document.visibilityState === 'visible')

  useEffect(() => {
    if (!enabled) return

    function startInterval(): void {
      if (intervalRef.current !== null) return // already running
      intervalRef.current = setInterval(() => {
        if (visibleRef.current) {
          void upsertPresence(listIdRef.current, 'viewing')
        }
      }, HEARTBEAT_MS)
    }

    function stopInterval(): void {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function handleVisibilityChange(): void {
      const nowVisible = document.visibilityState === 'visible'
      visibleRef.current = nowVisible

      if (nowVisible) {
        // Tab came back — ping immediately then restart interval.
        void upsertPresence(listIdRef.current, 'viewing')
        startInterval()
      } else {
        stopInterval()
      }
    }

    // Immediate ping on mount/enable (only if tab is visible).
    if (visibleRef.current) {
      void upsertPresence(listId, 'viewing')
    }

    startInterval()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void removePresence(listIdRef.current)
    }
  }, [enabled, listId]) // re-run if listId changes so cleanup fires for old id
}
