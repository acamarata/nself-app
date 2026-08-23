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

// np_device_tokens has no `is_active` column — it never has. The previous
// version filtered on one anyway and discarded the resulting GraphQL error with
// `data?.np_device_tokens ?? []`, so token resolution failed on every single
// notification and reported an empty device list rather than a fault. Live proof
// on production, 2026-08-24:
//   field 'is_active' not found in type: 'np_device_tokens_bool_exp'
// A stale token is retired by deleting its row (migration 017), so "registered"
// is the only state there is.
const FETCH_TOKENS = `
  query GetDeviceTokens($userId: uuid!) {
    np_device_tokens(where: { user_id: { _eq: $userId } }) {
      token
      platform
    }
  }
`;

/** Exposed so a test can assert the document itself, not just the behaviour. */
export const FETCH_TOKENS_FOR_TEST = FETCH_TOKENS;

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
        // Logged as well as captured. A count with no reason in it is the exact
        // shape of failure this service kept producing.
        console.error(`[notify-dispatch] ${device.platform} send failed:`, (err as Error).message);
        Sentry.captureException(err, {
          tags: { function: 'notify-dispatch', platform: device.platform },
        });
      }
    }
  } catch (err) {
    console.error('[notify-dispatch] could not resolve device tokens:', (err as Error).message);
    Sentry.captureException(err, { tags: { function: 'notify-dispatch' } });
    errors += 1;
  } finally {
    await Sentry.flush(2000);
  }

  return { dispatched, errors, unconfigured };
}
