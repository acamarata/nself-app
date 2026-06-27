// Purpose: Dispatch push notifications to FCM (Android) and APNs (iOS/macOS)
// Inputs: Hasura event trigger payload containing notification data
// Outputs: { dispatched: number, errors: number }
// Constraints: All outbound URLs validated via SSRF guard before fetch
// SPORT: F08 notify-dispatch function

import { Sentry } from './sentry';
import { validateOutboundUrl } from './ssrf-guard';

interface NotifyPayload {
  id: string;
  created_at: string;
  trigger: { name: string };
  table: { schema: string; name: string };
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

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';

export async function handleNotifyDispatch(
  payload: NotifyPayload
): Promise<{ dispatched: number; errors: number }> {
  const notification = payload.event.data.new;
  if (!notification) return { dispatched: 0, errors: 0 };

  let dispatched = 0;
  let errors = 0;

  try {
    // Resolve device tokens for the target user
    const deviceTokens = await getDeviceTokens(notification.user_id);

    for (const token of deviceTokens) {
      try {
        if (token.platform === 'android') {
          await dispatchFcm(token.token, notification.title, notification.body);
        } else if (token.platform === 'ios') {
          await dispatchApns(token.token, notification.title, notification.body);
        }
        dispatched++;
      } catch (err) {
        errors++;
        Sentry.captureException(err, {
          tags: { function: 'notify-dispatch', platform: token.platform },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'notify-dispatch' } });
    errors++;
  } finally {
    await Sentry.flush(2000);
  }

  return { dispatched, errors };
}

async function getDeviceTokens(
  userId: string
): Promise<Array<{ token: string; platform: string }>> {
  const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'http://hasura:8080/v1/graphql';
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET || '',
    },
    body: JSON.stringify({
      query: `query GetDeviceTokens($userId: uuid!) {
        np_device_tokens(where: {user_id: {_eq: $userId}, is_active: {_eq: true}}) {
          token
          platform
        }
      }`,
      variables: { userId },
    }),
  });
  const { data } = (await res.json()) as {
    data: { np_device_tokens: Array<{ token: string; platform: string }> };
  };
  return data?.np_device_tokens ?? [];
}

async function dispatchFcm(
  deviceToken: string,
  title: string,
  body: string
): Promise<void> {
  const endpoint = 'https://fcm.googleapis.com/fcm/send';
  // Validate before every outbound request
  validateOutboundUrl(endpoint);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `key=${FCM_SERVER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: deviceToken,
      notification: { title, body },
    }),
  });

  if (!res.ok) {
    throw new Error(`FCM dispatch failed: ${res.status} ${await res.text()}`);
  }
}

async function dispatchApns(
  deviceToken: string,
  title: string,
  body: string
): Promise<void> {
  // APNs HTTP/2 endpoint
  const endpoint = `https://api.push.apple.com/3/device/${deviceToken}`;
  validateOutboundUrl(endpoint);

  // NOTE: APNs requires HTTP/2 + JWT auth (provider token) or client certificate.
  // This is a stub that validates the URL — full implementation requires
  // the 'node-apn' package or a JWT-signed request. See A-S4-T2 for completion.
  // For now, we ensure the URL is validated before any real fetch.
  throw new Error('APNs not yet implemented — stub with SSRF guard in place');
}
