/**
 * Purpose: Subscribe to the offline-queue sync state and expose a typed
 *          sync status for use by TitleBarSyncStatus and useTrayStatus.
 *          Falls back to navigator.onLine if Epic B offline-queue adapter
 *          events are not yet available.
 * Inputs:  Browser network events (navigator.onLine / online / offline DOM events).
 *          Future: Epic B offline-queue adapter sync state events.
 * Outputs: { status, lastSyncedAt } — reactive sync state for UI consumption.
 * Constraints: No Tauri IPC in this hook — it is used in both browser and
 *              desktop contexts. Callers (useTrayStatus, TitleBarSyncStatus)
 *              add Tauri-specific side effects.
 * SPORT: no new entry (state derivation, not a tracked service command).
 */

import { useCallback, useEffect, useState } from 'react';

export type SyncStatus = 'online' | 'syncing' | 'offline';

export interface UseSyncStatusResult {
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

/**
 * Reactive sync status hook.
 * Stub implementation: uses navigator.onLine as the signal source.
 * Epic B integration: replace the useEffect body with offline-queue
 * adapter event subscription when Epic B adapter ships.
 */
export function useSyncStatus(): UseSyncStatusResult {
  const [status, setStatus] = useState<SyncStatus>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const handleOnline = useCallback(() => {
    setStatus('syncing');
    // Simulate brief syncing state, then transition to online.
    // Replace with actual Epic B sync event subscription.
    setTimeout(() => {
      setStatus('online');
      setLastSyncedAt(new Date());
    }, 1500);
  }, []);

  const handleOffline = useCallback(() => {
    setStatus('offline');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { status, lastSyncedAt };
}
