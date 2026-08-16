// Purpose: The single Hasura admin GraphQL client used by every backend handler.
//   Replaces five near-identical private copies (account-ops, collab-ops,
//   storage-presign, user-delete, user-export) that each got the error handling
//   subtly wrong.
//
// Inputs:  GraphQL document + variables. Endpoint / admin secret default to
//          HASURA_GRAPHQL_URL / HASURA_GRAPHQL_ADMIN_SECRET, and are overridable
//          per call (tests inject a stub `fetchImpl` instead of touching globals).
// Outputs: the `data` payload of the response, typed by the caller.
//
// Constraints:
//   - THE reason this module exists: Hasura answers a failed query with
//     HTTP 200 and a body of { errors: [...] }. Checking `res.ok` alone reports
//     every GraphQL validation, permission, and constraint failure as a success,
//     and the caller then reads `undefined` off the missing `data`. This client
//     inspects the body and throws HasuraGqlError instead.
//   - A response carrying BOTH `data` and `errors` is a failure. Hasura emits
//     that shape for partially-resolved multi-root operations; treating it as a
//     success silently drops whichever roots failed.
//   - Env is read at call time, not module load, so a handler imported before
//     the environment is populated still sees the right values.
//   - Errors never carry an httpStatus: a rejected admin query is a server-side
//     fault, so server.ts is right to answer 500. Use ActionError for 4xx.
//
// SPORT: F08 backend functions

/** One entry of a GraphQL `errors` array. */
export interface GraphQLErrorEntry {
  message: string;
  path?: unknown;
  extensions?: Record<string, unknown>;
}

/** Raised for any Hasura admin call that did not return a clean `data` payload. */
export class HasuraGqlError extends Error {
  override readonly name = 'HasuraGqlError';
  /** HTTP status of the Hasura response (0 when the request never completed). */
  readonly status: number;
  /** GraphQL errors as returned by Hasura; empty for transport-level failures. */
  readonly errors: GraphQLErrorEntry[];
  /** Operation name parsed out of the document, for log correlation. */
  readonly operation: string;

  constructor(
    message: string,
    opts: { status?: number; errors?: GraphQLErrorEntry[]; operation?: string } = {}
  ) {
    super(message);
    this.status = opts.status ?? 0;
    this.errors = opts.errors ?? [];
    this.operation = opts.operation ?? 'anonymous';
  }
}

export interface AdminGqlOptions {
  /** Hasura GraphQL endpoint. Defaults to HASURA_GRAPHQL_URL. */
  url?: string;
  /** Admin secret. Defaults to HASURA_GRAPHQL_ADMIN_SECRET. */
  adminSecret?: string;
  /** Injectable fetch, for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Abort signal forwarded to fetch. */
  signal?: AbortSignal;
}

const DEFAULT_URL = 'http://hasura:8080/v1/graphql';

/** Pull the operation name out of a document for error messages. Best effort. */
export function operationName(query: string): string {
  const match = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(query);
  return match?.[1] ?? 'anonymous';
}

function joinErrorMessages(errors: GraphQLErrorEntry[]): string {
  return errors
    .map((e) => (typeof e?.message === 'string' ? e.message : JSON.stringify(e)))
    .join('; ');
}

/**
 * Execute a GraphQL operation against Hasura with the admin secret.
 *
 * Resolves with the `data` payload. Throws {@link HasuraGqlError} when the
 * request fails, the response is not 2xx, the body is unparseable, the body
 * carries a non-empty `errors` array, or `data` is absent.
 */
export async function adminGql<T = Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown> = {},
  options: AdminGqlOptions = {}
): Promise<T> {
  const url = options.url ?? process.env['HASURA_GRAPHQL_URL'] ?? DEFAULT_URL;
  const adminSecret =
    options.adminSecret ?? process.env['HASURA_GRAPHQL_ADMIN_SECRET'] ?? '';
  const doFetch = options.fetchImpl ?? fetch;
  const operation = operationName(query);

  const res = await doFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query, variables }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new HasuraGqlError(
      `Hasura ${operation} failed: HTTP ${res.status} ${raw.slice(0, 500)}`,
      { status: res.status, operation }
    );
  }

  let body: { data?: unknown; errors?: GraphQLErrorEntry[] };
  try {
    body = JSON.parse(raw) as { data?: unknown; errors?: GraphQLErrorEntry[] };
  } catch {
    throw new HasuraGqlError(
      `Hasura ${operation} returned a non-JSON body: ${raw.slice(0, 500)}`,
      { status: res.status, operation }
    );
  }

  // Hasura reports validation / permission / constraint failures as HTTP 200
  // with an `errors` array — sometimes alongside a partially populated `data`.
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new HasuraGqlError(
      `Hasura ${operation} returned errors: ${joinErrorMessages(body.errors)}`,
      { status: res.status, errors: body.errors, operation }
    );
  }

  if (body.data === undefined || body.data === null) {
    throw new HasuraGqlError(
      `Hasura ${operation} returned no data payload`,
      { status: res.status, operation }
    );
  }

  return body.data as T;
}
