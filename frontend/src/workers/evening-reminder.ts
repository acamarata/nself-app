/**
 * Evening Reminder Worker
 *
 * Sends a notification at the configured time (default 8pm) asking:
 * "Anything you'd like to add to your todo list for tomorrow?"
 *
 * Usage: Run this as a periodic job (cron job, scheduled task, or via setInterval)
 */

import { notificationService } from '@/lib/services/notifications';
import { preferencesService } from '@/lib/services/preferences';

let intervalId: NodeJS.Timeout | null = null;
let lastNotificationDate: string | null = null;

/**
 * Check if it's time to send the evening reminder
 */
async function checkAndNotify() {
  try {
    const preferences = await preferencesService.getPreferences();
    if (!preferences) return;

    const { evening_reminder, evening_reminder_time } = preferences.notification_settings;

    // Skip if evening reminder is disabled
    if (!evening_reminder) return;

    // Parse configured time (HH:MM format)
    const [targetHours, targetMinutes] = evening_reminder_time.split(':').map(Number);

    // Get current time
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if we've already sent notification today
    if (lastNotificationDate === today) {
      return; // Already sent today
    }

    // Check if current time matches target time (within a 5-minute window)
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const targetTimeInMinutes = targetHours * 60 + targetMinutes;
    const diff = Math.abs(currentTimeInMinutes - targetTimeInMinutes);

    if (diff <= 5) {
      // Time to send notification!
      await notificationService.notifyEveningReminder();
      lastNotificationDate = today;
      console.log('[EveningReminder] Notification sent at', now.toISOString());
    }
  } catch (error) {
    console.error('[EveningReminder] Error:', error);
  }
}

/**
 * Start the evening reminder worker
 * Checks every minute if it's time to send the reminder
 */
export function startEveningReminderWorker() {
  if (intervalId) {
    console.warn('[EveningReminder] Worker already running');
    return;
  }

  // Check immediately
  checkAndNotify();

  // Then check every minute
  intervalId = setInterval(checkAndNotify, 60000); // 60 seconds

  console.log('[EveningReminder] Worker started');
}

/**
 * Stop the evening reminder worker
 */
export function stopEveningReminderWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[EveningReminder] Worker stopped');
  }
}

/**
 * Get worker status
 */
export function isEveningReminderRunning() {
  return intervalId !== null;
}

// Auto-start if in browser context
if (typeof window !== 'undefined') {
  // Start after a short delay to allow app initialization
  setTimeout(() => {
    startEveningReminderWorker();
  }, 5000);
}
