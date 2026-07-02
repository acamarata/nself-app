/**
 * Session bootstrap for the ɳTask MCP server.
 *
 * Purpose:    Resolve endpoints + a bearer token once at process start so
 *             every tool call reuses the same ActiveSession, without
 *             re-reading env/credentials per call.
 * Inputs:     Env vars NTASK_API_URL / NTASK_AUTH_URL / NTASK_TOKEN, or
 *             NTASK_EMAIL + NTASK_PASSWORD for login-on-start, or (if none
 *             of those are set) the CLI's stored ~/.config/ntask/credentials.json.
 * Outputs:    getSession() -> ActiveSession, memoized after first resolution.
 * Constraints: Never logs the token/password. Login-on-start is opt-in only
 *             (requires both NTASK_EMAIL and NTASK_PASSWORD) so the server
 *             does not silently attempt auth with partial config.
 * SPORT:      n/a (MCP transport glue).
 */

import { login } from '@nself/ntask-cli/lib/client';
import { resolveEndpoints } from '@nself/ntask-cli/lib/config';
import { loadSession } from '@nself/ntask-cli/lib/credentials';
import type { ActiveSession } from '@nself/ntask-cli/lib/session';

let cached: ActiveSession | undefined;

export async function getSession(): Promise<ActiveSession> {
  if (cached) return cached;

  const { apiUrl, authUrl, profileName } = resolveEndpoints({
    endpoint: process.env.NTASK_ENDPOINT,
    apiUrl: process.env.NTASK_API_URL,
    authUrl: process.env.NTASK_AUTH_URL,
  });

  if (process.env.NTASK_TOKEN) {
    cached = { apiUrl, authUrl, token: process.env.NTASK_TOKEN, profileName };
    return cached;
  }

  if (process.env.NTASK_EMAIL && process.env.NTASK_PASSWORD) {
    const result = await login(authUrl, process.env.NTASK_EMAIL, process.env.NTASK_PASSWORD);
    cached = { apiUrl, authUrl, token: result.accessToken, profileName };
    return cached;
  }

  const stored = loadSession(process.env.NTASK_PROFILE);
  if (stored) {
    cached = { apiUrl: stored.apiUrl, authUrl: stored.authUrl, token: stored.accessToken, profileName };
    return cached;
  }

  throw new Error(
    'ɳTask MCP server has no credentials. Set NTASK_TOKEN, or NTASK_EMAIL+NTASK_PASSWORD, ' +
      'or run `ntask login <email>` first so ~/.config/ntask/credentials.json is populated.',
  );
}
