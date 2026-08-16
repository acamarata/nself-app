// Purpose: One source of truth for how backend handlers reach hasura-auth, plus
//   the verified route table for the version this stack actually runs.
//
// Inputs:  HASURA_AUTH_URL (explicit override) or AUTH_HOST/AUTH_PORT.
// Outputs: authBaseUrl() and thin fetch wrappers used by account-ops/user-delete.
//
// Constraints:
//   - PORT DRIFT: docker compose sets AUTH_PORT (nTask dev uses a non-default
//     value because another local stack holds 4000). The handlers used to hardcode
//     `http://auth:4000`, so every auth call from the functions container hit a
//     closed port. The base URL is now DERIVED from AUTH_PORT so the two cannot
//     disagree, and env is read at call time (not module load) so a handler
//     imported before the environment is populated still sees the right value.
//
//   - ROUTE REALITY (verified 2026-08-16 against the running nhost/hasura-auth
//     0.36.0 container — probed both the Go front-end and the legacy Node server
//     it proxies to). These routes DO NOT EXIST and returned 404 "route-not-found":
//         PATCH  /user                     (was used for email AND password change)
//         GET    /user/sessions
//         DELETE /user/sessions/{id}
//         DELETE /users/{id}               (was used to delete the auth user)
//         POST   /user/mfa/totp/generate
//         POST   /user/mfa/totp/disable
//     The routes that DO exist, and what replaced each dead one:
//         POST   /user/email/change   { newEmail }        (Bearer)  -> email change
//         POST   /user/password       { newPassword }     (Bearer)  -> password change
//         POST   /signin/email-password { email, password }         -> re-auth
//         POST   /signout             { all }             (Bearer)  -> revoke sessions
//         GET    /mfa/totp/generate                       (Bearer)  -> TOTP secret
//         POST   /user/mfa   { code, activeMfaType }      (Bearer)  -> MFA on/off
//     Session listing/revocation and auth-user deletion have NO HTTP equivalent in
//     0.36.0; those handlers now go through the admin GraphQL path instead
//     (auth.refresh_tokens / auth.users), which is the same data hasura-auth owns.
//
// SPORT: F08 backend functions

/** Trailing-slash-safe base URL for the hasura-auth service. */
export function authBaseUrl(): string {
  const explicit = process.env['HASURA_AUTH_URL'];
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');
  const host = process.env['AUTH_SERVICE_HOST'] || 'auth';
  const port = process.env['AUTH_PORT'] || '4000';
  return `http://${host}:${port}`;
}

export interface AuthResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** GET a hasura-auth route as the calling user. */
export async function authGet<T = unknown>(
  path: string,
  accessToken: string
): Promise<AuthResponse<T>> {
  const res = await fetch(`${authBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ok: res.ok, status: res.status, data: await readJson<T>(res) };
}

/** POST a hasura-auth route. `accessToken` is omitted for unauthenticated routes. */
export async function authPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  accessToken?: string
): Promise<AuthResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetch(`${authBaseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await readJson<T>(res) };
}
