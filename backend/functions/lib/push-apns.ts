/**
 * Purpose: Send one push message to Apple Push Notification service over HTTP/2
 *   with provider-token (JWT ES256) authentication.
 *
 * Why this file exists:
 *   `dispatchApns` was `throw new Error('APNs not yet implemented — stub …')`.
 *   The credential gate was real, but so was this: the day the credentials
 *   arrived, iOS delivery would still have failed (2026-08-24 review, F10).
 *
 * Inputs:  APNS_* credentials from env, a device token, title and body.
 * Outputs: resolves on :status 200; throws with APNs' `reason` otherwise.
 *
 * Constraints:
 *   - APNs speaks HTTP/2 only, so this uses node:http2 rather than fetch.
 *   - The provider token is reused: Apple rejects a provider that mints a fresh
 *     token per request (TooManyProviderTokenUpdates) and requires renewal at
 *     least every hour. Cached for 45 minutes, comfortably inside both bounds.
 *   - Every endpoint passes the SSRF guard, which allows only the two Apple
 *     push hosts.
 *   - `connect` is injectable so tests exercise the request shape, the headers
 *     and the error mapping without reaching Apple.
 *   - Credentials absent throws PushNotConfiguredError, distinct from a
 *     delivery failure — "not configured" and "broken" must not look alike.
 *
 * SPORT: F08 notify-dispatch — iOS transport.
 */

import http2 from 'node:http2';
import { createSign } from 'node:crypto';
import { validateOutboundUrl } from '../ssrf-guard';
import { PushNotConfiguredError } from './push-fcm';

/** Apple requires renewal within the hour; well inside it. */
const TOKEN_TTL_MS = 45 * 60 * 1000;

export interface ApnsCredentials {
  /** Key ID of the .p8 signing key. */
  keyId: string;
  /** Apple developer team ID. */
  teamId: string;
  /** Contents of the .p8 file (PEM). */
  privateKey: string;
  /** The app's bundle identifier. */
  topic: string;
  /** api.push.apple.com (default) or api.sandbox.push.apple.com. */
  host: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function resolveApnsCredentials(): ApnsCredentials | null {
  const keyId = process.env['APNS_KEY_ID']?.trim();
  const teamId = process.env['APNS_TEAM_ID']?.trim();
  const privateKey = process.env['APNS_PRIVATE_KEY']?.trim();
  const topic = process.env['APNS_TOPIC']?.trim();
  if (!keyId || !teamId || !privateKey || !topic) return null;
  const sandbox = (process.env['APNS_SANDBOX'] ?? '').toLowerCase();
  return {
    keyId,
    teamId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    topic,
    host: sandbox === 'true' || sandbox === '1'
      ? 'api.sandbox.push.apple.com'
      : 'api.push.apple.com',
  };
}

export function buildProviderToken(cred: ApnsCredentials, now: Date): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cred.keyId }));
  const claims = b64url(JSON.stringify({
    iss: cred.teamId,
    iat: Math.floor(now.getTime() / 1000),
  }));
  const signer = createSign('SHA256');
  signer.update(`${header}.${claims}`);
  // APNs expects the raw 64-byte r||s pair, not the DER wrapper Node emits by
  // default. Getting this wrong yields a 403 InvalidProviderToken with no hint.
  const signature = signer.sign({ key: cred.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64url(signature)}`;
}

interface CachedProviderToken { token: string; mintedAt: number }
let cachedProviderToken: CachedProviderToken | null = null;

/** Exposed for tests; production code has no reason to call it. */
export function resetApnsTokenCache(): void {
  cachedProviderToken = null;
}

function providerToken(cred: ApnsCredentials, now: Date): string {
  if (cachedProviderToken && now.getTime() - cachedProviderToken.mintedAt < TOKEN_TTL_MS) {
    return cachedProviderToken.token;
  }
  const token = buildProviderToken(cred, now);
  cachedProviderToken = { token, mintedAt: now.getTime() };
  return token;
}

/** The slice of node:http2 this module uses, so tests can substitute it. */
export interface Http2Session {
  request(headers: Record<string, string | number>): Http2Stream;
  close(): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}
export interface Http2Stream {
  setEncoding(encoding: string): void;
  write(chunk: string): void;
  end(): void;
  on(event: string, listener: (...args: never[]) => void): Http2Stream;
}
export type ConnectFn = (authority: string) => Http2Session;

const defaultConnect: ConnectFn = (authority) =>
  http2.connect(authority) as unknown as Http2Session;

export interface ApnsMessage {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function dispatchApns(
  message: ApnsMessage,
  opts: { credentials?: ApnsCredentials | null; connect?: ConnectFn; now?: Date } = {},
): Promise<void> {
  const cred = opts.credentials !== undefined ? opts.credentials : resolveApnsCredentials();
  if (!cred) {
    throw new PushNotConfiguredError(
      'APNs credentials absent: set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY and APNS_TOPIC',
    );
  }
  const endpoint = `https://${cred.host}/3/device/${message.deviceToken}`;
  validateOutboundUrl(endpoint);

  const payload = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
    },
    ...(message.data ?? {}),
  });

  const connect = opts.connect ?? defaultConnect;
  const session = connect(`https://${cred.host}`);

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try { session.close(); } catch { /* already closed */ }
      if (err) reject(err); else resolve();
    };

    session.on('error', (err: unknown) => finish(err as Error));

    const stream = session.request({
      ':method': 'POST',
      ':path': `/3/device/${message.deviceToken}`,
      authorization: `bearer ${providerToken(cred, opts.now ?? new Date())}`,
      'apns-topic': cred.topic,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    });

    let status = 0;
    let body = '';
    stream.setEncoding('utf8');
    stream.on('response', ((headers: Record<string, number>) => {
      status = Number(headers[':status'] ?? 0);
    }) as never);
    stream.on('data', ((chunk: string) => { body += chunk; }) as never);
    stream.on('error', ((err: Error) => finish(err)) as never);
    stream.on('end', (() => {
      if (status === 200) return finish();
      // APNs answers failures with { "reason": "BadDeviceToken" } and nothing else.
      let reason = body.slice(0, 200);
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? reason;
      } catch { /* keep the raw body */ }
      finish(new Error(`APNs dispatch failed: ${status} ${reason}`));
    }) as never);

    stream.write(payload);
    stream.end();
  });
}
