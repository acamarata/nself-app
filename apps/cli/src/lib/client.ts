/**
 * ɳTask API client — hasura-auth login + GraphQL execution.
 *
 * Purpose:    Single shared client used by both the CLI commands and the
 *             MCP server tools, so auth/GraphQL wiring is written once.
 * Inputs:     Endpoint URLs (config.ts), a bearer token (from credentials.ts
 *             or NTASK_TOKEN env), and GraphQL query/variables.
 * Outputs:    `login()` -> StoredSession; `graphql()` -> typed JSON data or
 *             throws NTaskApiError with the GraphQL error message.
 * Constraints: Never logs request/response bodies containing tokens or
 *             passwords. Every network call has a bounded timeout so a CLI
 *             invocation never hangs indefinitely.
 * SPORT:      n/a (transport layer, not a tracked domain entity).
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export class NTaskApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'NTaskApiError';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly email: string;
  readonly expiresIn: number;
}

/** Sign in against hasura-auth's email/password endpoint. */
export async function login(authUrl: string, email: string, password: string): Promise<LoginResult> {
  const res = await fetchWithTimeout(`${authUrl}/signin/email-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, any>;

  if (!res.ok) {
    const message = body?.message || body?.error || `Login failed (HTTP ${res.status})`;
    throw new NTaskApiError(message, res.status);
  }

  const session = body?.session;
  if (!session?.accessToken) {
    throw new NTaskApiError('Login response missing session/accessToken (unexpected auth server shape)');
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    userId: session.user?.id ?? '',
    email: session.user?.email ?? email,
    expiresIn: session.accessTokenExpiresIn ?? 900,
  };
}

/** Refresh an access token using a stored refresh token. */
export async function refreshAccessToken(authUrl: string, refreshToken: string): Promise<LoginResult> {
  const res = await fetchWithTimeout(`${authUrl}/token/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !body?.accessToken) {
    throw new NTaskApiError(body?.message || `Token refresh failed (HTTP ${res.status})`, res.status);
  }
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? refreshToken,
    userId: body.user?.id ?? '',
    email: body.user?.email ?? '',
    expiresIn: body.accessTokenExpiresIn ?? 900,
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/** Execute a GraphQL query/mutation against Hasura with a bearer token. */
export async function graphql<T = Record<string, unknown>>(
  apiUrl: string,
  token: string,
  query: string,
  variables?: object,
): Promise<T> {
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await res.json().catch(() => ({}))) as GraphQLResponse<T>;

  if (!res.ok) {
    throw new NTaskApiError(`GraphQL request failed (HTTP ${res.status})`, res.status);
  }
  if (body.errors?.length) {
    throw new NTaskApiError(body.errors.map((e) => e.message).join('; '));
  }
  if (!body.data) {
    throw new NTaskApiError('GraphQL response missing data');
  }
  return body.data;
}
