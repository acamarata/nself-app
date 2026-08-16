// Purpose: Hasura Action handlers for authenticated account management operations
//   - changeEmail: request email change via hasura-auth PATCH /user
//   - changePassword: re-authenticate, update password, revoke other sessions
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
//   - changePassword requires the CURRENT password, verified against hasura-auth
//     before the change, and revokes every refresh token after it. A valid access
//     token alone is not sufficient authority to rotate a password.
//   - All Hasura traffic goes through lib/admin-gql, which throws on the HTTP-200
//     { errors: [...] } responses the old per-file helper reported as success.
// SPORT: F08 backend functions; J-S2-T1, J-S2-T2

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { badRequest, unauthorized } from './lib/action-error';

// HASURA_AUTH_URL: the auth service endpoint used by account-ops functions.
//   AUTH_MODE=bundled (default): http://auth:4000 (local hasura-auth container)
//   AUTH_MODE=external: https://auth.{env}.nself.org (shared nself auth)
// Set HASURA_AUTH_URL in .env.secrets or CI to override for the target environment.
const AUTH_URL = process.env.HASURA_AUTH_URL || 'http://auth:4000';

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

/**
 * Best-effort audit write. Used for records made AFTER the operation already
 * succeeded — a failed audit insert must not turn a completed change into an
 * error for the caller. Failures are reported, never swallowed.
 */
async function logAudit(
  query: string,
  variables: Record<string, unknown>,
  op: string
): Promise<void> {
  try {
    await adminGql(query, variables);
  } catch (err) {
    console.error(`[account-ops] audit log insert failed for ${op}:`, err);
    Sentry.captureException(err, { tags: { function: 'account-ops', op, step: 'audit' } });
  }
}

/**
 * Pull the caller's access token out of the action payload, or null.
 *
 * Hasura forwards the original Authorization header when the action declares
 * `forward_client_headers`. The token is not a standard session variable, so
 * absence is normal — callers decide whether it is fatal.
 */
function tryExtractBearerToken(payload: HasuraActionPayload): string | null {
  const token = payload.session_variables['x-hasura-access-token']
    || payload.session_variables['authorization']?.replace('Bearer ', '');
  return token || null;
}

function extractBearerToken(payload: HasuraActionPayload): string {
  const token = tryExtractBearerToken(payload);
  if (!token) {
    // A missing credential is a 401, not a server fault. Previously this threw a
    // bare Error and server.ts answered 500.
    throw unauthorized('Missing access token in session variables', 'MISSING_ACCESS_TOKEN');
  }
  return token;
}

/** Resolve the caller's email address from the auth user mirror. */
async function getUserEmail(userId: string): Promise<string | null> {
  const data = await adminGql<{ users_by_pk: { email?: string } | null }>(
    `query GetUserEmail($id: uuid!) { users_by_pk(id: $id) { email } }`,
    { id: userId }
  );
  return data.users_by_pk?.email ?? null;
}

/**
 * Verify a password by attempting a sign-in for the given address.
 *
 * Returns an access token when hasura-auth minted a session, or null when the
 * credentials were correct but a second factor is still outstanding (the MFA
 * challenge response carries no session). Throws {@link ActionError} 401 when
 * the password is wrong.
 */
async function verifyPassword(
  email: string,
  password: string
): Promise<{ accessToken: string | null }> {
  const res = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (res.status === 401 || res.status === 403 || res.status === 400) {
    throw unauthorized('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  }
  if (!res.ok) {
    throw new Error(`Password verification failed upstream: ${res.status}`);
  }

  const data = (await res.json().catch(() => null)) as {
    session?: { accessToken?: string } | null;
  } | null;

  return { accessToken: data?.session?.accessToken ?? null };
}

/**
 * Revoke every refresh token for the caller, ending all other sessions.
 * Best effort: the password has already been changed by the time this runs, so a
 * failure here is reported but does not undo the change.
 */
async function revokeAllSessions(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_URL}/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      console.error(`[account-ops] session revocation returned ${res.status}`);
      Sentry.captureMessage(`session revocation returned ${res.status}`, 'warning');
      return false;
    }
    return true;
  } catch (err) {
    console.error('[account-ops] session revocation failed:', err);
    Sentry.captureException(err, { tags: { function: 'account-ops', op: 'revokeAllSessions' } });
    return false;
  }
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
  const { newEmail } = payload.input as unknown as ChangeEmailInput;

  if (!newEmail || !newEmail.includes('@')) {
    throw badRequest('Invalid email address', 'INVALID_EMAIL');
  }

  try {
    const result = await authPatch('/user', { email: newEmail }, accessToken);

    if (!result.ok) {
      throw new Error(
        `Email change failed: ${result.status} — ${JSON.stringify(result.data)}`
      );
    }

    // Audit log — best effort; the change request is already lodged upstream.
    await logAudit(
      `mutation LogEmailChange($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "email_change_requested"
          metadata: $meta
        }) { id }
      }`,
      { userId, meta: { newEmail, requestedAt: new Date().toISOString() } },
      'changeEmail'
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
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResult {
  success: boolean;
  message: string;
}

/**
 * changePassword — re-authenticate, then set a new password and end other sessions.
 *
 * SECURITY: possession of an access token is NOT sufficient authority to change a
 * password. Without a current-password check, anyone holding a stolen or leaked
 * token (XSS, a shared device, a logged bearer header) can rotate the password and
 * lock the real owner out permanently. The current password is therefore verified
 * against hasura-auth before the change, and every refresh token is revoked after
 * it, so a token stolen before the change cannot outlive it.
 */
export async function changePassword(
  payload: HasuraActionPayload
): Promise<ChangePasswordResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { currentPassword, newPassword } = payload.input as unknown as ChangePasswordInput;

  if (!userId) {
    throw unauthorized('Missing x-hasura-user-id in session variables', 'MISSING_USER_ID');
  }
  if (!currentPassword) {
    throw badRequest('Current password is required.', 'MISSING_CURRENT_PASSWORD');
  }
  if (!newPassword || newPassword.length < 8) {
    throw badRequest('Password must be at least 8 characters', 'WEAK_PASSWORD');
  }
  if (newPassword === currentPassword) {
    throw badRequest('New password must differ from the current one.', 'PASSWORD_UNCHANGED');
  }

  try {
    // 1. Re-authenticate. Throws 401 when the current password is wrong.
    const email = await getUserEmail(userId);
    if (!email) {
      throw unauthorized('Could not resolve the account email.', 'UNKNOWN_ACCOUNT');
    }
    const { accessToken: verifiedToken } = await verifyPassword(email, currentPassword);

    // 2. Apply the change. Prefer the token we just minted — it is guaranteed to
    //    belong to the verified credential — and fall back to the caller's.
    const accessToken = verifiedToken ?? tryExtractBearerToken(payload);
    if (!accessToken) {
      throw unauthorized(
        'No usable access token: re-authenticate and retry.',
        'MISSING_ACCESS_TOKEN'
      );
    }

    const result = await authPatch('/user', { password: newPassword }, accessToken);
    if (!result.ok) {
      const msg = result.status === 401
        ? 'Session expired. Please log in again.'
        : `Password change failed: ${JSON.stringify(result.data)}`;
      throw new Error(msg);
    }

    // 3. Revoke every refresh token so sessions opened with the old password —
    //    including an attacker's — cannot be renewed.
    const revoked = await revokeAllSessions(accessToken);

    await logAudit(
      `mutation LogPasswordChange($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "password_changed"
          metadata: $meta
        }) { id }
      }`,
      { userId, meta: { sessionsRevoked: revoked, changedAt: new Date().toISOString() } },
      'changePassword'
    );

    return {
      success: true,
      message: revoked
        ? 'Password updated. All other sessions have been signed out.'
        : 'Password updated. Other sessions could not be signed out — revoke them manually.',
    };
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
  const { sessionId } = payload.input as unknown as RevokeSessionInput;

  if (!sessionId) throw badRequest('sessionId is required', 'MISSING_SESSION_ID');

  try {
    const result = await authDelete(`/user/sessions/${sessionId}`, accessToken);
    // 200/204 = revoked, 404 = already gone (idempotent)
    if (!result.ok && result.status !== 404) {
      throw new Error(`Revoke session failed: ${result.status}`);
    }

    await logAudit(
      `mutation LogSessionRevoke($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "session_revoked"
          metadata: $meta
        }) { id }
      }`,
      { userId, meta: { sessionId } },
      'revokeSession'
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

    await logAudit(
      `mutation LogMfaEnabled($userId: uuid!) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "mfa_enabled"
          metadata: {}
        }) { id }
      }`,
      { userId },
      'enableMfa'
    );

    // Persist server-visible MFA state (task_users.mfa_enabled) so any
    // client (web SecurityTab, mobile) can read real status, not just the
    // local TOTP-setup flow state. See migration 027.
    await adminGql(
      `mutation SetMfaEnabled($userId: uuid!) {
        update_task_users_by_pk(pk_columns: { user_id: $userId }, _set: { mfa_enabled: true }) { user_id }
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
  const { otp } = payload.input as unknown as DisableMfaInput;

  if (!otp) throw badRequest('otp is required to disable MFA', 'MISSING_OTP');

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

    await logAudit(
      `mutation LogMfaDisabled($userId: uuid!) {
        insert_np_account_activity_one(object: {
          user_id: $userId
          action: "mfa_disabled"
          metadata: {}
        }) { id }
      }`,
      { userId },
      'disableMfa'
    );

    // Persist server-visible MFA state (task_users.mfa_enabled). See migration 027.
    await adminGql(
      `mutation SetMfaDisabled($userId: uuid!) {
        update_task_users_by_pk(pk_columns: { user_id: $userId }, _set: { mfa_enabled: false }) { user_id }
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
