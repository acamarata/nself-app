// Purpose: Hasura Action handlers for authenticated account management operations
//   - changeEmail:    hasura-auth POST /user/email/change
//   - changePassword: re-authenticate, POST /user/password, revoke other sessions
//   - listSessions:   read auth.refresh_tokens via admin GraphQL
//   - revokeSession:  delete one auth.refresh_tokens row via admin GraphQL
//   - enableMfa:      hasura-auth GET /mfa/totp/generate
//   - disableMfa:     hasura-auth POST /user/mfa
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
//   - ROUTES: every hasura-auth path here was probed against the running
//     nhost/hasura-auth 0.36.0 container. `PATCH /user`, `GET /user/sessions` and
//     `DELETE /user/sessions/{id}` — the routes this file used to call — return
//     404 "route-not-found" and never existed in this version. See lib/auth-service.
//   - SESSION OPS RUN AS ADMIN: 0.36.0 exposes no per-user session API, so
//     listSessions/revokeSession read and write auth.refresh_tokens directly. Both
//     are therefore scoped to `user_id = x-hasura-user-id` IN THE QUERY — the auth
//     service is no longer doing that scoping for us, and an unscoped admin
//     mutation would let any caller revoke any other user's session by id.
// SPORT: F08 backend functions; J-S2-T1, J-S2-T2

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { badRequest, unauthorized, ActionError } from './lib/action-error';
import { authGet, authPost } from './lib/auth-service';

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

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

/**
 * Resolve the caller's email address from auth.users.
 *
 * ROOT FIELD: `user`, not `users_by_pk`. hasura-auth applies its OWN table
 * configuration to the auth schema on every startup, renaming auth.users' root
 * fields to users / user / insertUser / updateUsers / deleteUsers and its columns
 * to camelCase. The previous `users_by_pk` selection therefore did not exist in
 * query_root and every call threw "field 'users_by_pk' not found" — which made
 * changePassword fail for every user before it ever reached the password check.
 * Verified by introspecting the running instance (2026-08-16).
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const data = await adminGql<{ user: { email?: string } | null }>(
    `query GetUserEmail($id: uuid!) { user(id: $id) { email } }`,
    { id: userId }
  );
  return data.user?.email ?? null;
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
  const res = await authPost<{ session?: { accessToken?: string } | null }>(
    '/signin/email-password',
    { email, password }
  );

  if (res.status === 401 || res.status === 403 || res.status === 400) {
    throw unauthorized('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  }
  if (!res.ok) {
    throw new Error(`Password verification failed upstream: ${res.status}`);
  }

  return { accessToken: res.data?.session?.accessToken ?? null };
}

/**
 * Revoke every refresh token for the caller, ending all other sessions.
 * Best effort: the password has already been changed by the time this runs, so a
 * failure here is reported but does not undo the change.
 */
async function revokeAllSessions(accessToken: string): Promise<boolean> {
  try {
    const res = await authPost('/signout', { all: true }, accessToken);
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
    // hasura-auth 0.36.0: POST /user/email/change { newEmail }. The old call was
    // PATCH /user, which this version answers with 404 "route-not-found".
    const result = await authPost('/user/email/change', { newEmail }, accessToken);

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        throw unauthorized('Session expired. Please log in again.', 'AUTH_SESSION_EXPIRED');
      }
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

    // hasura-auth 0.36.0: POST /user/password { newPassword }. The old call was
    // PATCH /user, which this version answers with 404 "route-not-found".
    const result = await authPost('/user/password', { newPassword }, accessToken);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        throw unauthorized('Session expired. Please log in again.', 'AUTH_SESSION_EXPIRED');
      }
      throw new Error(`Password change failed: ${result.status} — ${JSON.stringify(result.data)}`);
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

/** One row of auth.refresh_tokens, shaped to the `Session` action type. */
interface SessionRow {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  type: string | null;
}

interface SessionsResult {
  sessions: SessionRow[];
}

/**
 * listSessions — the caller's live refresh tokens, newest first.
 *
 * hasura-auth 0.36.0 has no session API (`GET /user/sessions` is a 404), so this
 * reads auth.refresh_tokens — the table hasura-auth itself uses to represent a
 * session — through the admin client. The `user_id` predicate is the ONLY thing
 * scoping the result to the caller, so it is derived from the session variable
 * and never from client input. Token hashes are never selected.
 */
export async function listSessions(
  payload: HasuraActionPayload
): Promise<SessionsResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  if (!userId) {
    throw unauthorized('Missing x-hasura-user-id in session variables', 'MISSING_USER_ID');
  }

  try {
    // Root field and columns are hasura-auth's, not Hasura's defaults:
    // authRefreshTokens / userId / createdAt / expiresAt. hasura-auth re-applies
    // that configuration to the auth schema on every startup.
    const data = await adminGql<{
      authRefreshTokens: Array<{
        id: string;
        createdAt: string | null;
        expiresAt: string | null;
        type: string | null;
      }>;
    }>(
      `query ListSessions($userId: uuid!) {
        authRefreshTokens(
          where: { userId: { _eq: $userId } }
          order_by: { createdAt: desc }
        ) { id createdAt expiresAt type }
      }`,
      { userId }
    );

    return {
      sessions: (data.authRefreshTokens ?? []).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        type: r.type,
      })),
    };
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

/**
 * revokeSession — end one of the caller's own sessions.
 *
 * SECURITY: `DELETE /user/sessions/{id}` does not exist in hasura-auth 0.36.0, so
 * the delete runs as admin against auth.refresh_tokens. Admin bypasses every
 * permission, which means the `user_id` predicate below is the whole
 * authorisation check — without it, any authenticated caller could pass another
 * user's session id and sign them out. sessionId is client input and is used only
 * as an equality filter alongside the session-derived user id.
 */
export async function revokeSession(
  payload: HasuraActionPayload
): Promise<RevokeSessionResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { sessionId } = payload.input as unknown as RevokeSessionInput;

  if (!userId) {
    throw unauthorized('Missing x-hasura-user-id in session variables', 'MISSING_USER_ID');
  }
  if (!sessionId) throw badRequest('sessionId is required', 'MISSING_SESSION_ID');

  try {
    const data = await adminGql<{
      deleteAuthRefreshTokens: { affected_rows: number } | null;
    }>(
      `mutation RevokeSession($userId: uuid!, $sessionId: uuid!) {
        deleteAuthRefreshTokens(
          where: { id: { _eq: $sessionId }, userId: { _eq: $userId } }
        ) { affected_rows }
      }`,
      { userId, sessionId }
    );

    // 0 rows = the session is not the caller's, or was already revoked. Both get
    // the same answer so this cannot be used to probe for other users' session ids.
    if ((data.deleteAuthRefreshTokens?.affected_rows ?? 0) === 0) {
      throw new ActionError('Session not found.', 'SESSION_NOT_FOUND', 404);
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
    // hasura-auth 0.36.0: GET /mfa/totp/generate. The old call —
    // POST /user/mfa/totp/generate — is a 404 "route-not-found" in this version.
    // The response field for the QR image is `imageUrl`; `qrCodeUrl` is accepted
    // too so a future version renaming it back does not silently return null.
    const res = await authGet<{
      totpSecret?: string;
      imageUrl?: string;
      qrCodeUrl?: string;
    }>('/mfa/totp/generate', accessToken);
    const data = res.data;

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw unauthorized('Session expired. Please log in again.', 'AUTH_SESSION_EXPIRED');
      }
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
      qrCodeUrl: data?.imageUrl ?? data?.qrCodeUrl,
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
    // hasura-auth 0.36.0: POST /user/mfa { code, activeMfaType }. An empty
    // activeMfaType turns MFA off; the old call — POST /user/mfa/totp/disable —
    // is a 404 "route-not-found" in this version.
    const res = await authPost('/user/mfa', { code: otp, activeMfaType: '' }, accessToken);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw unauthorized('Session expired. Please log in again.', 'AUTH_SESSION_EXPIRED');
      }
      if (res.status === 400) {
        throw badRequest('That code was not accepted. Try the current one.', 'INVALID_OTP');
      }
      throw new Error(`MFA disable failed: ${res.status} — ${JSON.stringify(res.data)}`);
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
