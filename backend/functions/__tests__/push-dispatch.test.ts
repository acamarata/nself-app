/**
 * Purpose: Pin the push transports to the APIs that actually exist.
 *
 * The previous implementation targeted Google's legacy /fcm/send endpoint, which
 * was removed in 2024, and threw a stub for APNs. Both looked plausible and
 * neither could ever deliver. These tests assert the v1 URL, the OAuth bearer
 * header, the v1 message envelope, and the APNs provider-token headers — the
 * exact details that were wrong.
 * SPORT: F08 notify-dispatch.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  dispatchFcm, buildAssertion, resolveFcmCredentials, resetFcmTokenCache,
  PushNotConfiguredError,
} from '../lib/push-fcm.js';
import {
  dispatchApns, buildProviderToken, resolveApnsCredentials, resetApnsTokenCache,
  type ConnectFn,
} from '../lib/push-apns.js';
import { handleNotifyDispatch } from '../notify-dispatch.js';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const RSA_PEM = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const EC_PEM = ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const FCM_CRED = {
  projectId: 'ntask-prod', clientEmail: 'push@ntask.iam.gserviceaccount.com',
  privateKey: RSA_PEM,
};
const APNS_CRED = {
  keyId: 'ABC123DEFG', teamId: 'TEAM123456', privateKey: EC_PEM,
  topic: 'org.nself.ntask', host: 'api.push.apple.com',
};

const NOW = new Date('2026-08-24T12:00:00.000Z');

function fcmFetch(sendStatus = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }),
        { status: 200 });
    }
    return new Response(sendStatus === 200 ? '{}' : '{"error":{"message":"UNREGISTERED"}}',
      { status: sendStatus });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('FCM v1 transport', () => {
  beforeEach(() => resetFcmTokenCache());

  test('posts to the v1 messages:send endpoint, not legacy /fcm/send', async () => {
    const { impl, calls } = fcmFetch();
    await dispatchFcm({ deviceToken: 'dev-1', title: 'T', body: 'B' },
      { credentials: FCM_CRED, fetchImpl: impl, now: NOW });

    const send = calls.at(-1)!;
    assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/ntask-prod/messages:send');
    assert.doesNotMatch(send.url, /\/fcm\/send$/, 'legacy endpoint was removed by Google in 2024');
  });

  test('authenticates with an OAuth bearer token, not a server key', async () => {
    const { impl, calls } = fcmFetch();
    await dispatchFcm({ deviceToken: 'dev-1', title: 'T', body: 'B' },
      { credentials: FCM_CRED, fetchImpl: impl, now: NOW });

    const headers = calls.at(-1)!.init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer ya29.test');
    assert.doesNotMatch(headers['Authorization']!, /^key=/, 'legacy server-key auth');
  });

  test('sends the v1 message envelope', async () => {
    const { impl, calls } = fcmFetch();
    await dispatchFcm({ deviceToken: 'dev-1', title: 'T', body: 'B', data: { todo_id: 't1' } },
      { credentials: FCM_CRED, fetchImpl: impl, now: NOW });

    const body = JSON.parse(String(calls.at(-1)!.init.body)) as Record<string, unknown>;
    assert.deepEqual(body, {
      message: {
        token: 'dev-1',
        notification: { title: 'T', body: 'B' },
        data: { todo_id: 't1' },
      },
    });
    assert.ok(!Object.prototype.hasOwnProperty.call(body, 'to'),
      'v1 uses message.token, not the legacy top-level `to`');
  });

  test('reuses the access token across sends', async () => {
    const { impl, calls } = fcmFetch();
    const opts = { credentials: FCM_CRED, fetchImpl: impl, now: NOW };
    await dispatchFcm({ deviceToken: 'a', title: 'T', body: 'B' }, opts);
    await dispatchFcm({ deviceToken: 'b', title: 'T', body: 'B' }, opts);

    const tokenCalls = calls.filter((c) => c.url.includes('oauth2.googleapis.com'));
    assert.equal(tokenCalls.length, 1);
  });

  test('a non-2xx from FCM throws with the response text', async () => {
    const { impl } = fcmFetch(404);
    await assert.rejects(
      () => dispatchFcm({ deviceToken: 'dev-1', title: 'T', body: 'B' },
        { credentials: FCM_CRED, fetchImpl: impl, now: NOW }),
      /FCM dispatch failed: 404.*UNREGISTERED/s,
    );
  });

  test('missing credentials is a named, distinct error', async () => {
    await assert.rejects(
      () => dispatchFcm({ deviceToken: 'd', title: 'T', body: 'B' }, { credentials: null }),
      (err: Error) => err instanceof PushNotConfiguredError,
    );
  });

  test('the assertion is a signed JWT for the messaging scope', () => {
    const [header, claims, sig] = buildAssertion(FCM_CRED, NOW).split('.');
    const h = JSON.parse(Buffer.from(header!, 'base64url').toString());
    const c = JSON.parse(Buffer.from(claims!, 'base64url').toString());
    assert.equal(h.alg, 'RS256');
    assert.equal(c.iss, FCM_CRED.clientEmail);
    assert.equal(c.scope, 'https://www.googleapis.com/auth/firebase.messaging');
    assert.equal(c.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(c.exp - c.iat, 3600);
    assert.ok(sig && sig.length > 0);
  });

  test('resolves credentials from the service-account JSON blob', () => {
    const prev = process.env['FCM_SERVICE_ACCOUNT_JSON'];
    process.env['FCM_SERVICE_ACCOUNT_JSON'] = JSON.stringify({
      project_id: 'p', client_email: 'e@x', private_key: 'line1\\nline2',
    });
    const cred = resolveFcmCredentials()!;
    assert.equal(cred.projectId, 'p');
    assert.equal(cred.privateKey, 'line1\nline2', 'escaped newlines must be restored');
    if (prev === undefined) delete process.env['FCM_SERVICE_ACCOUNT_JSON'];
    else process.env['FCM_SERVICE_ACCOUNT_JSON'] = prev;
  });
});

// ── APNs ─────────────────────────────────────────────────────────────────────

function apnsConnect(status = 200, body = '') {
  const captured: { headers?: Record<string, string | number>; payload?: string } = {};
  const connect: ConnectFn = () => {
    const listeners: Record<string, Array<(...a: never[]) => void>> = {};
    const stream = {
      setEncoding() { /* utf8 */ },
      write(chunk: string) { captured.payload = chunk; },
      end() {
        setImmediate(() => {
          listeners['response']?.forEach((l) => (l as (h: unknown) => void)({ ':status': status }));
          if (body) listeners['data']?.forEach((l) => (l as (c: string) => void)(body));
          listeners['end']?.forEach((l) => (l as () => void)());
        });
      },
      on(event: string, listener: (...a: never[]) => void) {
        (listeners[event] ??= []).push(listener);
        return stream;
      },
    };
    return {
      request(headers: Record<string, string | number>) {
        captured.headers = headers;
        return stream;
      },
      close() { /* no socket */ },
      on() { return undefined; },
    };
  };
  return { connect, captured };
}

describe('APNs transport', () => {
  beforeEach(() => resetApnsTokenCache());

  test('sends a provider-token request with the bundle topic', async () => {
    const { connect, captured } = apnsConnect();
    await dispatchApns({ deviceToken: 'dev-ios', title: 'T', body: 'B' },
      { credentials: APNS_CRED, connect, now: NOW });

    assert.equal(captured.headers![':method'], 'POST');
    assert.equal(captured.headers![':path'], '/3/device/dev-ios');
    assert.equal(captured.headers!['apns-topic'], 'org.nself.ntask');
    assert.equal(captured.headers!['apns-push-type'], 'alert');
    assert.match(String(captured.headers!['authorization']), /^bearer eyJ/);
  });

  test('the payload is a real aps alert', async () => {
    const { connect, captured } = apnsConnect();
    await dispatchApns({ deviceToken: 'd', title: 'Title', body: 'Body' },
      { credentials: APNS_CRED, connect, now: NOW });

    assert.deepEqual(JSON.parse(captured.payload!), {
      aps: { alert: { title: 'Title', body: 'Body' }, sound: 'default' },
    });
  });

  test('a rejection surfaces APNs\' reason', async () => {
    const { connect } = apnsConnect(400, '{"reason":"BadDeviceToken"}');
    await assert.rejects(
      () => dispatchApns({ deviceToken: 'd', title: 'T', body: 'B' },
        { credentials: APNS_CRED, connect, now: NOW }),
      /APNs dispatch failed: 400 BadDeviceToken/,
    );
  });

  test('missing credentials is a named, distinct error — not a stub throw', async () => {
    await assert.rejects(
      () => dispatchApns({ deviceToken: 'd', title: 'T', body: 'B' }, { credentials: null }),
      (err: Error) => err instanceof PushNotConfiguredError
        && /APNS_KEY_ID/.test(err.message),
    );
  });

  test('the provider token is ES256 with the key id in the header', () => {
    const [header, claims] = buildProviderToken(APNS_CRED, NOW).split('.');
    const h = JSON.parse(Buffer.from(header!, 'base64url').toString());
    const c = JSON.parse(Buffer.from(claims!, 'base64url').toString());
    assert.equal(h.alg, 'ES256');
    assert.equal(h.kid, 'ABC123DEFG');
    assert.equal(c.iss, 'TEAM123456');
  });

  test('the ES256 signature is the raw r||s pair APNs requires', () => {
    // Node's default DER encoding is variable length and Apple rejects it with
    // an unhelpful 403 InvalidProviderToken. P-256 raw is always 64 bytes.
    const sig = buildProviderToken(APNS_CRED, NOW).split('.')[2]!;
    assert.equal(Buffer.from(sig, 'base64url').length, 64);
  });

  test('sandbox host is selected by APNS_SANDBOX', () => {
    const env = { ...process.env };
    Object.assign(process.env, {
      APNS_KEY_ID: 'k', APNS_TEAM_ID: 't', APNS_PRIVATE_KEY: EC_PEM,
      APNS_TOPIC: 'org.x', APNS_SANDBOX: 'true',
    });
    assert.equal(resolveApnsCredentials()!.host, 'api.sandbox.push.apple.com');
    process.env['APNS_SANDBOX'] = 'false';
    assert.equal(resolveApnsCredentials()!.host, 'api.push.apple.com');
    for (const k of ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY', 'APNS_TOPIC', 'APNS_SANDBOX']) {
      if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k];
    }
  });
});

// ── handler ──────────────────────────────────────────────────────────────────

const event = (overrides: Record<string, unknown> = {}) => ({
  event: {
    data: {
      new: {
        id: 'n1', user_id: 'u1', type: 'new_todo',
        title: 'Task assigned to you', body: 'Pay rent', ...overrides,
      },
    },
  },
});

describe('handleNotifyDispatch', () => {
  test('routes each device to its platform transport', async () => {
    const sent: string[] = [];
    const r = await handleNotifyDispatch(event(), {
      getDeviceTokens: async () => [
        { token: 'a1', platform: 'android' },
        { token: 'i1', platform: 'ios' },
      ],
      sendAndroid: async (t) => { sent.push(`fcm:${t.token}`); },
      sendIos: async (t) => { sent.push(`apns:${t.token}`); },
    });

    assert.deepEqual(sent, ['fcm:a1', 'apns:i1']);
    assert.deepEqual(r, { dispatched: 2, errors: 0, unconfigured: 0 });
  });

  test('missing credentials count as unconfigured, not as errors', async () => {
    // A self-hosted stack with no push setup must not look like an outage.
    const r = await handleNotifyDispatch(event(), {
      getDeviceTokens: async () => [{ token: 'a1', platform: 'android' }],
      sendAndroid: async () => { throw new PushNotConfiguredError('no creds'); },
    });
    assert.deepEqual(r, { dispatched: 0, errors: 0, unconfigured: 1 });
  });

  test('one failing device does not stop the rest', async () => {
    const r = await handleNotifyDispatch(event(), {
      getDeviceTokens: async () => [
        { token: 'a1', platform: 'android' },
        { token: 'a2', platform: 'android' },
      ],
      sendAndroid: async (t) => { if (t.token === 'a1') throw new Error('BadDeviceToken'); },
    });
    assert.deepEqual(r, { dispatched: 1, errors: 1, unconfigured: 0 });
  });

  test('the token query filters on user only — np_device_tokens has no is_active', async () => {
    // The previous version filtered on a column that does not exist and threw
    // the GraphQL error away, so token resolution failed on every notification
    // while reporting "no devices". Pin the document, not just the behaviour.
    const { FETCH_TOKENS_FOR_TEST } = await import('../notify-dispatch.js');
    assert.match(FETCH_TOKENS_FOR_TEST, /np_device_tokens\(where: \{ user_id: \{ _eq: \$userId \} \}\)/);
    assert.doesNotMatch(FETCH_TOKENS_FOR_TEST, /is_active/);
  });

  test('a failed token lookup is an error, not an empty device list', async () => {
    const r = await handleNotifyDispatch(event(), {
      getDeviceTokens: async () => { throw new Error("field 'is_active' not found"); },
    });
    assert.deepEqual(r, { dispatched: 0, errors: 1, unconfigured: 0 });
  });

  test('no notification row is a no-op', async () => {
    const r = await handleNotifyDispatch({ event: { data: { new: null } } });
    assert.deepEqual(r, { dispatched: 0, errors: 0, unconfigured: 0 });
  });
});
