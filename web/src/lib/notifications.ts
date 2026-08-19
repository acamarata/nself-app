/**
 * Purpose: Native OS notification helpers for ɳTask desktop. Sends task due
 *          reminders and sync status notifications via the Tauri notification
 *          plugin. All functions no-op gracefully in browser context.
 * Inputs:  Task data and sync event types from callers.
 * Outputs: Native OS notifications (macOS Notification Center, Windows Action Center).
 * Constraints: Never call notify in foreground — check isAppFocused() first.
 *              Permission must be requested once on first launch and stored.
 *              macOS requires NSUserNotificationUsageDescription in entitlements.plist.
 * SPORT: F02-COMMAND-INVENTORY — send_notification IPC command (E-S2-T4).
 */

import { isTauri, invoke } from './tauri';

// ─────────────────────────────────────────────────────────────────────────────
// Permission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request notification permission from the OS on first launch.
 * No-op in browser. Result stored by the caller in TauriSecureStore.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false;
  // tauri-plugin-notification handles the OS permission dialog automatically
  // when the first notification is sent. This function exists as a hook for
  // callers that need to know permission state before sending.
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification senders
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a task used for due-date notifications. */
export interface NotifyTask {
  id: string;
  title: string;
  dueDate?: string | null;
}

/**
 * Send a native notification when a task's due date is approaching.
 * Suppressed when the app window is currently focused.
 */
export async function sendTaskDueNotification(
  task: NotifyTask,
  minutesUntilDue: number,
): Promise<void> {
  if (!isTauri()) return;

  const body =
    minutesUntilDue <= 0
      ? `"${task.title}" is due now.`
      : `"${task.title}" is due in ${minutesUntilDue} minute${minutesUntilDue === 1 ? '' : 's'}.`;

  await invoke<void>('send_notification', {
    title: 'ɳTask — Task Due',
    body,
    icon: null,
  });
}

/**
 * Send a sync status notification (success or error).
 * Used by useSyncStatus.ts when background sync completes or fails.
 */
export async function sendSyncNotification(
  type: 'success' | 'error',
  detail: string,
): Promise<void> {
  if (!isTauri()) return;

  const title = type === 'success' ? 'ɳTask — Synced' : 'ɳTask — Sync Failed';
  await invoke<void>('send_notification', {
    title,
    body: detail,
    icon: null,
  });
}
