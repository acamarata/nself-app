/**
 * Purpose: Sync status indicator pill for the ɳTask app header.
 *          Shows ● Online, ⟳ Syncing…, or ⚠ Offline based on network state.
 *          In Tauri context, also updates the OS window title via IPC.
 * Inputs:  useSyncStatus — reactive sync state.
 *          useTrayStatus — side effect: tray icon sync (desktop only).
 * Outputs: JSX pill component + IPC side effects in Tauri context.
 * Constraints: Visible in both browser and Tauri contexts.
 *              IPC calls are guarded by isTauri() inside the hooks.
 * SPORT: no new entry (UI component).
 */

import { useEffect } from 'react';
import { isTauri, invoke } from '../lib/tauri';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTrayStatus } from '../hooks/useTrayStatus';

const STATUS_CONFIG = {
  online: {
    label: '● Online',
    className: 'text-green-600 dark:text-green-400',
    windowTitle: 'ɳTask',
    trayState: 'connected' as const,
  },
  syncing: {
    label: '⟳ Syncing…',
    className: 'text-blue-600 dark:text-blue-400',
    windowTitle: 'ɳTask — Syncing',
    trayState: 'syncing' as const,
  },
  offline: {
    label: '⚠ Offline',
    className: 'text-amber-600 dark:text-amber-400',
    windowTitle: 'ɳTask — Offline',
    trayState: 'offline' as const,
  },
} as const;

export function TitleBarSyncStatus(): React.JSX.Element | null {
  const { status } = useSyncStatus();
  const config = STATUS_CONFIG[status];

  // Side effect: update OS window title in Tauri context.
  useEffect(() => {
    if (!isTauri()) return;
    invoke<void>('set_window_title', { title: config.windowTitle }).catch((err: unknown) => {
      console.warn('[TitleBarSyncStatus] set_window_title failed:', err);
    });
  }, [config.windowTitle]);

  // Side effect: sync tray icon state.
  useTrayStatus(config.trayState);

  return (
    <span
      className={`text-xs font-medium select-none ${config.className}`}
      aria-live="polite"
      aria-label={`Sync status: ${status}`}
    >
      {config.label}
    </span>
  );
}
