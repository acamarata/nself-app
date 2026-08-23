/**
 * Purpose: Send one push message through Firebase Cloud Messaging HTTP v1.
 *
 * Why this file exists:
 *   notify-dispatch used `POST https://fcm.googleapis.com/fcm/send` with an
 *   `Authorization: key=<server key>` header. Google removed that legacy HTTP
 *   API in 2024, so those requests fail whatever credentials are supplied — the
 *   known "we have no FCM credentials" gate was never the only blocker
 *   (2026-08-24 review, F10). v1 needs an OAuth2 access token minted from a
 *   service account, and a differently shaped body.
 *
 * Inputs:  service-account credentials from env, a device token, title and body.
 * Outputs: resolves on a 2xx from FCM; throws with FCM's message otherwise.
 *
 * Constraints:
 *   - Every outbound URL passes the SSRF guard before the request, unchanged
 *     from the previous implementation.
 *   - Access tokens are cached until shortly before expiry. Minting one per push
 *     would add a round trip and an RSA signature to every notification.
 *   - `fetchImpl` is injectable so tests assert the v1 URL, the bearer header and
 *     the message shape without network access or real credentials.
 *   - Credentials absent is a distinct, named error. "Push is not configured"
 *     and "push is broken" must not look the same in logs.
 *
 * SPORT: F08 notify-dispatch — Android transport.
 */

import { createSign } from 'node:crypto';
import { validateOutboundUrl } from '../ssrf-guard';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  /** PEM private key. */
  privateKey: string;
}

export class PushNotConfiguredError extends Error {
  override readonly name = 'PushNotConfiguredError';
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Read credentials from env. Accepts either the whole service-account JSON
 * (FCM_SERVICE_ACCOUNT_JSON, what the Firebase console hands you) or the three
 * fields separately, because a JSON blob in an env file is awkward to manage.
 */
export function resolveFcmCredentials(): FcmCredentials | null {
  const raw = process.env['FCM_SERVICE_ACCOUNT_JSON']?.trim();
  if (raw) {
    try {
      const j = JSON.parse(raw) as Record<string, string>;
      if (j['project_id'] && j['client_email'] && j['private_key']) {
        return {
          projectId: j['project_id'],
          clientEmail: j['client_email'],
          privateKey: j['private_key'].replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Fall through to the discrete vars; a malformed blob should not hide them.
    }
  }
  const projectId = process.env['FCM_PROJECT_ID']?.trim();
  const clientEmail = process.env['FCM_CLIENT_EMAIL']?.trim();
  const privateKey = process.env['FCM_PRIVATE_KEY']?.trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
}

/** Signed JWT assertion for the OAuth2 service-account flow. */
export function buildAssertion(cred: FcmCredentials, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: cred.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(cred.privateKey))}`;
}

interface CachedToken { token: string; expiresAt: number }
let cachedToken: CachedToken | null = null;

/** Exposed for tests; production code has no reason to call it. */
export function resetFcmTokenCache(): void {
  cachedToken = null;
}

export async function getAccessToken(
  cred: FcmCredentials,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<string> {
  // 60s of slack: a token that expires in flight is a failed push.
  if (cachedToken && cachedToken.expiresAt - 60_000 > now.getTime()) {
    return cachedToken.token;
  }
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildAssertion(cred, now),
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FCM token request failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error(`FCM token response had no access_token: ${text.slice(0, 300)}`);
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: now.getTime() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

export interface FcmMessage {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function dispatchFcm(
  message: FcmMessage,
  opts: { credentials?: FcmCredentials | null; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<void> {
  const cred = opts.credentials !== undefined ? opts.credentials : resolveFcmCredentials();
  if (!cred) {
    throw new PushNotConfiguredError(
      'FCM credentials absent: set FCM_SERVICE_ACCOUNT_JSON, or FCM_PROJECT_ID + ' +
      'FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY',
    );
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${cred.projectId}/messages:send`;
  validateOutboundUrl(endpoint);

  const token = await getAccessToken(cred, fetchImpl, opts.now ?? new Date());
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: message.deviceToken,
        notification: { title: message.title, body: message.body },
        ...(message.data ? { data: message.data } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`FCM dispatch failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}
