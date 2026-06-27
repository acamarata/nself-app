// Purpose: Hasura Action handlers for authenticated account management operations
//   - changeEmail: request email change via hasura-auth PATCH /user
//   - changePassword: update password via hasura-auth PATCH /user
//   - listSessions: proxy to hasura-auth GET /user/sessions
//   - revokeSession: proxy to hasura-auth DELETE /user/sessions/{id}
//   - enableMfa: proxy to hasura-auth TOTP enable endpoint
//   - disableMfa: proxy to hasura-auth TOTP disable endpoint
//
// Inputs: Hasura Action payload; user JWT forwarded as Bearer token
// Outputs: operation-specific result objects
// Constraints:
//   - Never expose admin secret to client
//   - changeEmail triggers re-verification; old email valid until confirmed
//   - changePassword requires current valid access token (re-auth built-in to hasura-auth)
// SPORT: F08 backend functions; J-S2-T1, J-S2-T2

import { Sentry } from './sentry';

const AUTH_URL = process.env.HASURA_AUTH_URL || 'http://auth:4000';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';
const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'http://hasura:8080/v1/graphql';

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Forward authenticated request to hasura-auth using the user's own access token. */
async function authPatch(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function authGet(
  path: string,
  accessToken: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function authDelete(
  path: string,
  accessToken: string
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ok: res.ok, status: res.status };
}

async function adminGql(
  query: string,
  variables: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Hasura: ${res.status}`);
  return res.json();
}

function extractBearerToken(payload: HasuraActionPayload): string {
  // Hasura forwards the original Authorization header in request.headers via the action
  // payload headers, or we pull it from session_variables as a fallback.
  // The action webhook receives request headers via action.request.headers (v2 actions).
  // In practice the functions router should forward the Authorization header directly.
  const token = payload.session_variables['x-hasura-access-token']
    || payload.session_variables['authorization']?.replace('Bearer ', '');
  if (!token) {
    throw new Error('Missing access token in session variables');
  }
  return token;
}

// ── changeEmail ─────────────────────────────────────────────────────────────

interface ChangeEmailInput {
  newEmail: string;
}

interface ChangeEmailResult {
  success: boolean;
  message: string;
}

export async function changeEmail(
  payload: HasuraActionPayload
): Promise<ChangeEmailResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const accessToken = extractBearerToken(payload);
  const { newEmail } = payload.input as ChangeEmailInput;

  if (!newEmail || !newEmail.includes('@')) {
    throw new Error('Invalid email address');
  }

  try {
    const result = await authPatch('/user', { email: newEmail }, accessToken);

    if (!result.ok) {
      throw new Error(
        `Email change failed: ${result.status} — ${JSON.stringify(result.data)}`
      );
    }

    // Audit log
    await adminGql(
      `mutation LogEmailChange($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "email_change_requested"
          metadata: $meta
        }) { id }
      }`,
      { userId, meta: { newEmail, requestedAt: new Date().toISOString() } }
    );

    return {
      success: true,
      message: 'Verification email sent to new address. Check your inbox.',
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'changeEmail' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}

// ── changePassword ───────────────────────────────────────────────────────────

interface ChangePasswordInput {
  newPassword: string;
}

interface ChangePasswordResult {
  success: boolean;
  message: string;
}

export async function changePassword(
  payload: HasuraActionPayload
): Promise<ChangePasswordResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const accessToken = extractBearerToken(payload);
  const { newPassword } = payload.input as ChangePasswordInput;

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  try {
    const result = await authPatch('/user', { password: newPassword }, accessToken);

    if (!result.ok) {
      // hasura-auth returns 401 on invalid current token, 400 on validation failure
      const msg = result.status === 401
        ? 'Session expired. Please log in again.'
        : `Password change failed: ${JSON.stringify(result.data)}`;
      throw new Error(msg);
    }

    await adminGql(
      `mutation LogPasswordChange($userId: uuid!) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "password_changed"
          metadata: {}
        }) { id }
      }`,
      { userId }
    );

    return { success: true, message: 'Password updated successfully.' };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'changePassword' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}

// ── listSessions ─────────────────────────────────────────────────────────────

interface SessionsResult {
  sessions: unknown[];
}

export async function listSessions(
  payload: HasuraActionPayload
): Promise<SessionsResult> {
  const accessToken = extractBearerToken(payload);

  try {
    const result = await authGet('/user/sessions', accessToken);
    if (!result.ok) {
      throw new Error(`Failed to fetch sessions: ${result.status}`);
    }
    const sessions = Array.isArray(result.data) ? result.data : [];
    return { sessions };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'listSessions' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}

// ── revokeSession ─────────────────────────────────────────────────────────────

interface RevokeSessionInput {
  sessionId: string;
}

interface RevokeSessionResult {
  success: boolean;
}

export async function revokeSession(
  payload: HasuraActionPayload
): Promise<RevokeSessionResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const accessToken = extractBearerToken(payload);
  const { sessionId } = payload.input as RevokeSessionInput;

  if (!sessionId) throw new Error('sessionId is required');

  try {
    const result = await authDelete(`/user/sessions/${sessionId}`, accessToken);
    // 200/204 = revoked, 404 = already gone (idempotent)
    if (!result.ok && result.status !== 404) {
      throw new Error(`Revoke session failed: ${result.status}`);
    }

    await adminGql(
      `mutation LogSessionRevoke($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "session_revoked"
          metadata: $meta
        }) { id }
      }`,
      { userId, meta: { sessionId } }
    );

    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'revokeSession' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}

// ── enableMfa ─────────────────────────────────────────────────────────────────

interface MfaResult {
  success: boolean;
  totpSecret?: string;
  qrCodeUrl?: string;
  message?: string;
}

export async function enableMfa(
  payload: HasuraActionPayload
): Promise<MfaResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const accessToken = extractBearerToken(payload);

  try {
    // hasura-auth TOTP: POST /user/mfa/totp/generate
    const res = await fetch(`${AUTH_URL}/user/mfa/totp/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = (await res.json().catch(() => null)) as {
      totpSecret?: string;
      qrCodeUrl?: string;
    } | null;

    if (!res.ok) {
      throw new Error(`MFA enable failed: ${res.status} — ${JSON.stringify(data)}`);
    }

    await adminGql(
      `mutation LogMfaEnabled($userId: uuid!) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "mfa_enabled"
          metadata: {}
        }) { id }
      }`,
      { userId }
    );

    return {
      success: true,
      totpSecret: data?.totpSecret,
      qrCodeUrl: data?.qrCodeUrl,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'enableMfa' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}

// ── disableMfa ─────────────────────────────────────────────────────────────────

interface DisableMfaInput {
  otp: string;
}

export async function disableMfa(
  payload: HasuraActionPayload
): Promise<MfaResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const accessToken = extractBearerToken(payload);
  const { otp } = payload.input as DisableMfaInput;

  if (!otp) throw new Error('otp is required to disable MFA');

  try {
    // hasura-auth: POST /user/mfa/totp/disable with OTP confirmation
    const res = await fetch(`${AUTH_URL}/user/mfa/totp/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ otp }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(`MFA disable failed: ${res.status} — ${JSON.stringify(data)}`);
    }

    await adminGql(
      `mutation LogMfaDisabled($userId: uuid!) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "mfa_disabled"
          metadata: {}
        }) { id }
      }`,
      { userId }
    );

    return { success: true, message: 'MFA disabled.' };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'disableMfa' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
