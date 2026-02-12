/**
 * Geolocation Monitor Worker
 *
 * Continuously monitors user's location and sends notifications when they
 * approach locations associated with todos or lists.
 *
 * Features:
 * - 100m proximity detection
 * - Respects user's location permissions
 * - Throttles notifications (won't spam)
 * - Battery-efficient (uses low-accuracy mode)
 */

import { geolocationService } from '@/lib/services/geolocation';
import { preferencesService } from '@/lib/services/preferences';

let isMonitoring = false;

/**
 * Start geolocation monitoring
 */
export async function startGeolocationMonitor() {
  if (isMonitoring) {
    console.warn('[GeolocationMonitor] Already monitoring');
    return;
  }

  try {
    // Check if location reminders are enabled
    const preferences = await preferencesService.getPreferences();
    if (!preferences?.notification_settings.location_reminders) {
      console.log('[GeolocationMonitor] Location reminders disabled in settings');
      return;
    }

    // Check location permission
    const permission = await geolocationService.checkPermission();
    if (!permission.granted) {
      console.log('[GeolocationMonitor] Location permission not granted');
      return;
    }

    // Start monitoring with geolocation service
    // This will automatically check proximity and send notifications
    geolocationService.startMonitoring(60000); // Check every 60 seconds

    isMonitoring = true;
    console.log('[GeolocationMonitor] Started successfully');
  } catch (error) {
    console.error('[GeolocationMonitor] Failed to start:', error);
  }
}

/**
 * Stop geolocation monitoring
 */
export function stopGeolocationMonitor() {
  if (!isMonitoring) return;

  geolocationService.stopMonitoring();
  isMonitoring = false;
  console.log('[GeolocationMonitor] Stopped');
}

/**
 * Get monitoring status
 */
export function isGeolocationMonitoring() {
  return isMonitoring;
}

/**
 * Manually trigger a proximity check
 */
export async function checkProximityNow() {
  try {
    const position = await geolocationService.getCurrentPosition();
    const lists = await geolocationService.checkProximityToLists(position.latitude, position.longitude);
    const todos = await geolocationService.checkProximityToTodos(position.latitude, position.longitude);

    console.log('[GeolocationMonitor] Proximity check:', {
      position,
      nearbyLists: lists.length,
      nearbyTodos: todos.length,
    });

    return { position, lists, todos };
  } catch (error) {
    console.error('[GeolocationMonitor] Proximity check failed:', error);
    return null;
  }
}

// Auto-start if in browser context and user has granted permission
if (typeof window !== 'undefined') {
  // Check permission and start after app initialization
  setTimeout(async () => {
    const permission = await geolocationService.checkPermission();
    if (permission.granted) {
      await startGeolocationMonitor();
    }
  }, 10000); // 10 second delay to allow app to fully load
}
