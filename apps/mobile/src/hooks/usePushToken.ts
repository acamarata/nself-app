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
import { createLogger } from '@nself/observability';
import { REGISTER_DEVICE_TOKEN } from '../lib/deviceTokenOps';

export interface PushTokenOptions {
  accessToken: string | null;
}

const logger = createLogger({ name: 'ntask-mobile' });

/** RFC-4122 UUID shape — the only valid form of `extra.eas.projectId`. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * isValidEasProjectId — guards against the checked-in placeholder ("ntask-mobile")
 * or any other non-UUID value shipping to a real build. `eas init` replaces
 * app.json's extra.eas.projectId with the real project UUID (see RELEASING.md);
 * until that has run, getExpoPushTokenAsync would reject at runtime with an
 * opaque error, silently disabling push. Catching the bad shape here lets us
 * fail loud instead.
 */
export function isValidEasProjectId(id: string | undefined): id is string {
  return typeof id === 'string' && UUID_PATTERN.test(id);
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
      if (!isValidEasProjectId(projectId)) {
        // Loud, unconditional — must not silently ship as "push works". Emits in
        // every build (dev + release), not just __DEV__, so a bad projectId shows
        // up in release logs / Sentry rather than only local development.
        logger.error(
          'Push registration disabled: invalid EAS projectId in app.json extra.eas.projectId. ' +
            'Expected a UUID from `eas init` — see RELEASING.md § One-time setup.',
          { projectId: projectId ?? '(missing)' },
        );
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
