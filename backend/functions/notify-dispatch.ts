/**
 * Purpose: Deliver a new np_notifications row to the user's registered devices.
 *
 * Inputs:  Hasura event-trigger payload for INSERT on public.np_notifications.
 * Outputs: { dispatched, errors, unconfigured } — `unconfigured` counts devices
 *          skipped because that platform has no credentials, so a stack with no
 *          push setup reports zero errors instead of a wall of them.
 *
 * Constraints:
 *   - The transports live in lib/push-fcm.ts (FCM HTTP v1) and lib/push-apns.ts
 *     (APNs HTTP/2 provider token). Both were rewritten on 2026-08-24: the old
 *     code posted to Google's legacy /fcm/send endpoint, removed in 2024, and
 *     APNs was a throwing stub. Delivery would have failed on the day the
 *     credentials arrived.
 *   - Credentials remain an external gate. That gate is now the ONLY blocker,
 *     which is the point of landing the code first.
 *   - One device failing must not stop the others.
 *   - Every outbound URL passes the SSRF guard (inside each transport).
 *
 * SPORT: F08 notify-dispatch function.
 */

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { dispatchFcm, PushNotConfiguredError } from './lib/push-fcm';
import { dispatchApns } from './lib/push-apns';

interface NotifyPayload {
  trigger?: { name: string };
  table?: { schema: string; name: string };
  event: {
    data: {
      new: {
        id: string;
        user_id: string;
        type: string;
        title: string;
        body: string;
        data?: Record<string, unknown>;
      } | null;
    };
  };
}

export interface DeviceToken {
  token: string;
  platform: string;
}

export interface DispatchResult {
  dispatched: number;
  errors: number;
  /** Devices skipped because that platform has no credentials configured. */
  unconfigured: number;
}

/** Injectable so tests drive the handler without Hasura or a push provider. */
export interface NotifyDeps {
  getDeviceTokens?: (userId: string) => Promise<DeviceToken[]>;
  sendAndroid?: (t: DeviceToken, title: string, body: string) => Promise<void>;
  sendIos?: (t: DeviceToken, title: string, body: string) => Promise<void>;
}

const FETCH_TOKENS = `
  query GetDeviceTokens($userId: uuid!) {
    np_device_tokens(where: { user_id: { _eq: $userId }, is_active: { _eq: true } }) {
      token
      platform
    }
  }
`;

async function defaultGetDeviceTokens(userId: string): Promise<DeviceToken[]> {
  const data = await adminGql<{ np_device_tokens: DeviceToken[] }>(FETCH_TOKENS, { userId });
  return data?.np_device_tokens ?? [];
}

export async function handleNotifyDispatch(
  payload: NotifyPayload,
  deps: NotifyDeps = {},
): Promise<DispatchResult> {
  const notification = payload?.event?.data?.new;
  if (!notification) return { dispatched: 0, errors: 0, unconfigured: 0 };

  const getTokens = deps.getDeviceTokens ?? defaultGetDeviceTokens;
  const sendAndroid = deps.sendAndroid
    ?? ((t, title, body) => dispatchFcm({ deviceToken: t.token, title, body }));
  const sendIos = deps.sendIos
    ?? ((t, title, body) => dispatchApns({ deviceToken: t.token, title, body }));

  let dispatched = 0;
  let errors = 0;
  let unconfigured = 0;

  try {
    const devices = await getTokens(notification.user_id);

    for (const device of devices) {
      try {
        if (device.platform === 'android') {
          await sendAndroid(device, notification.title, notification.body);
        } else if (device.platform === 'ios') {
          await sendIos(device, notification.title, notification.body);
        } else {
          // A platform nothing can deliver to is not an error to retry.
          unconfigured += 1;
          continue;
        }
        dispatched += 1;
      } catch (err) {
        if (err instanceof PushNotConfiguredError) {
          // Expected on a stack with no push credentials. Counted, not alarmed:
          // reporting it as an error would bury real failures under it.
          unconfigured += 1;
          continue;
        }
        errors += 1;
        Sentry.captureException(err, {
          tags: { function: 'notify-dispatch', platform: device.platform },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'notify-dispatch' } });
    errors += 1;
  } finally {
    await Sentry.flush(2000);
  }

  return { dispatched, errors, unconfigured };
}
