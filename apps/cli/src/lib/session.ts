/**
 * Resolves an authenticated session (endpoints + bearer token) for a command.
 *
 * Purpose:    Single entry point both the CLI commands and MCP tools call to
 *             get { apiUrl, token }. Prefers NTASK_TOKEN env (useful for MCP
 *             clients / CI) then falls back to the stored credentials file.
 * Inputs:     Endpoint overrides (config.ts) + optional profile name.
 * Outputs:    ActiveSession or throws NTaskApiError with a "run ntask login"
 *             hint when nothing usable is found.
 * Constraints: Never prints the token. Does not attempt silent password
 *             re-auth — expired sessions surface a clear error asking the
 *             caller to `ntask login` again (refresh is a possible follow-up,
 *             kept out of scope to avoid silently rotating tokens on disk).
 * SPORT:      n/a (CLI-local session glue, not a tracked domain entity).
 */

import { NTaskApiError } from './client.js';
import { loadSession } from './credentials.js';
import { resolveEndpoints, type EndpointOverrides } from './config.js';

export interface ActiveSession {
  readonly apiUrl: string;
  readonly authUrl: string;
  readonly token: string;
  readonly profileName: string;
}

export function getActiveSession(overrides: EndpointOverrides & { profile?: string } = {}): ActiveSession {
  const envToken = process.env.NTASK_TOKEN;
  const { apiUrl, authUrl, profileName } = resolveEndpoints(overrides, overrides.profile);

  if (envToken) {
    return { apiUrl, authUrl, token: envToken, profileName };
  }

  const stored = loadSession(overrides.profile);
  if (!stored) {
    throw new NTaskApiError(
      'Not logged in. Run `ntask login <email>` first, or set NTASK_TOKEN.',
    );
  }

  // An explicit --endpoint selects the endpoints, even when a session is stored.
  // Previously the stored profile's URLs always won, so `ntask lists --endpoint
  // prod` silently queried whatever host the last login used — a local stack, in
  // the common case — and reported "fetch failed" while looking like it had
  // talked to production.
  return {
    apiUrl: overrides.apiUrl ?? (overrides.endpoint ? apiUrl : stored.apiUrl),
    authUrl: overrides.authUrl ?? (overrides.endpoint ? authUrl : stored.authUrl),
    token: stored.accessToken,
    profileName,
  };
}
