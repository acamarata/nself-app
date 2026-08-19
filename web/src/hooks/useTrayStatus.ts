/**
 * Purpose: Sync ɳTask tray icon state with offline-queue sync status.
 *          Calls set_tray_status IPC command whenever sync state changes.
 *          No-op in browser context (isTauri() guard).
 * Inputs:  syncStatus — current sync state from useSyncStatus hook.
 * Outputs: Side effect only — updates native tray icon via IPC.
 * Constraints: Must guard all invoke() calls with isTauri().
 *              Tray state strings must match Rust commands.rs set_tray_status match arms.
 * SPORT: F02-COMMAND-INVENTORY — set_tray_status IPC command (E-S2-T1).
 */

import { useEffect } from 'react';
import { isTauri, invoke } from '../lib/tauri';

export type TrayState = 'connected' | 'syncing' | 'offline';

/**
 * Sync tray icon state with the current offline-queue sync status.
 * Call this hook once in the app root (inside the sync status provider).
 */
export function useTrayStatus(trayState: TrayState): void {
  useEffect(() => {
    if (!isTauri()) return;

    invoke<void>('set_tray_status', { state: trayState }).catch((err: unknown) => {
      console.warn('[useTrayStatus] set_tray_status failed:', err);
    });
  }, [trayState]);
}
