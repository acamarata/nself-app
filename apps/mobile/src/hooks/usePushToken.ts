/**
 * Purpose: Register Expo push token with the backend after authentication.
 * Requests notification permission if not yet determined, derives the user id
 * from the JWT locally (no extra profile fetch), and upserts the token into
 * np_device_tokens via the RegisterDeviceToken GraphQL mutation (urql).
 * Handles token refresh; graceful fallback if device lacks push capability.
 * Constraints: Must be rendered inside <UrqlProvider> (uses urql's useMutation).
 *   Graceful no-op if permissions denied or projectId missing — never throws.
 * SPORT: C-S6-T2
 */
import { useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useMutation } from 'urql';
import { REGISTER_DEVICE_TOKEN } from '../lib/deviceTokenOps';

export interface PushTokenOptions {
  accessToken: string | null;
}

/** Maps RN Platform.OS to the np_device_tokens.platform check constraint values. */
function toDeviceTokenPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * decodeUserIdFromJwt — extract the `sub` claim from a JWT access token.
 * Same technique as ProfileScreen's email decode; avoids threading userId
 * through prop chains or depending on auth-core's internal user shape.
 */
function decodeUserIdFromJwt(accessToken: string): string | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function usePushToken({ accessToken }: PushTokenOptions): void {
  const userId = useMemo(() => (accessToken ? decodeUserIdFromJwt(accessToken) : null), [accessToken]);
  const [, registerDeviceToken] = useMutation(REGISTER_DEVICE_TOKEN);

  const registerToken = useCallback(async () => {
    if (!userId || !accessToken) return;

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) {
        if (__DEV__) console.warn('[usePushToken] No EAS projectId in app.json extra.eas.projectId');
        return;
      }

      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        // Not yet asked (or previously dismissed) — prompt once. If the user
        // explicitly denied, this resolves to 'denied' again and we no-op below.
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      const result = await registerDeviceToken({ token, platform: toDeviceTokenPlatform() });
      if (result.error && __DEV__) {
        console.warn('[usePushToken] Token registration failed:', result.error.message);
      }
    } catch (err) {
      // Graceful fallback — push registration failure must not crash the app
      if (__DEV__) console.warn('[usePushToken] Error:', err);
    }
  }, [userId, accessToken, registerDeviceToken]);

  useEffect(() => {
    void registerToken();

    // Re-register on token refresh
    const sub = Notifications.addPushTokenListener(() => void registerToken());
    return () => sub.remove();
  }, [registerToken]);
}
