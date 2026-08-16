// Purpose: Typed errors for Hasura Action handlers that carry an HTTP status.
// Inputs: message, machine-readable code, HTTP status
// Outputs: Error subclass with `extensions` in the shape server.ts already reads
//   ({ code, httpStatus }) so a caller fault surfaces as 4xx instead of 500.
// Constraints:
//   - `extensions` is returned verbatim to the GraphQL client — never put secrets,
//     tokens, upstream response bodies, or SQL in it.
//   - httpStatus must be a real status code; server.ts falls back to 500 without one.
// SPORT: F08 backend functions

export interface ActionErrorExtensions extends Record<string, unknown> {
  code: string;
  httpStatus: number;
}

/** Error carrying an HTTP status that server.ts maps onto the action response. */
export class ActionError extends Error {
  override readonly name = 'ActionError';
  readonly extensions: ActionErrorExtensions;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.extensions = { ...extra, code, httpStatus };
  }
}

/** 400 — the caller sent a malformed or incomplete payload. */
export function badRequest(message: string, code = 'BAD_REQUEST'): ActionError {
  return new ActionError(message, code, 400);
}

/** 401 — the caller is not authenticated, or proved no credential we can use. */
export function unauthorized(message: string, code = 'UNAUTHENTICATED'): ActionError {
  return new ActionError(message, code, 401);
}

/** 403 — the caller is authenticated but not allowed to do this. */
export function forbidden(message: string, code = 'FORBIDDEN'): ActionError {
  return new ActionError(message, code, 403);
}
