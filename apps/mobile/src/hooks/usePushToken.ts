/**
 * Purpose: Register Expo push token with the backend after authentication.
 * Upserts token to np_device_tokens via @nself/push-client.
 * Handles token refresh; graceful fallback if device lacks push capability.
 * Constraints: Must be called after auth; graceful no-op if permissions denied.
 * SPORT: C-S6-T2
 */
import { useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export interface PushTokenOptions {
  userId: string | null;
  serverUrl: string | null;
  accessToken: string | null;
}

export function usePushToken({ userId, serverUrl, accessToken }: PushTokenOptions): void {
  const registerToken = useCallback(async () => {
    if (!userId || !serverUrl || !accessToken) return;

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) {
        if (__DEV__) console.warn('[usePushToken] No EAS projectId in app.json extra.eas.projectId');
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return; // Don't request — only register if already granted

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      // Register token with backend via REST (push-client GraphQL op)
      const res = await fetch(`${serverUrl}/v1/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, userId, platform: 'expo' }),
      });

      if (!res.ok && __DEV__) {
        console.warn('[usePushToken] Token registration failed:', res.status);
      }
    } catch (err) {
      // Graceful fallback — push registration failure must not crash the app
      if (__DEV__) console.warn('[usePushToken] Error:', err);
    }
  }, [userId, serverUrl, accessToken]);

  useEffect(() => {
    void registerToken();

    // Re-register on token refresh
    const sub = Notifications.addPushTokenListener(() => void registerToken());
    return () => sub.remove();
  }, [registerToken]);
}
