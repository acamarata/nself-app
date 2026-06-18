/**
 * Purpose: Result<T, E> type for explicit error handling without exceptions
 * Inputs: Generic Ok/Err constructors
 * Outputs: Result<T,E> discriminated union + helper functions
 * Constraints: Zero dependencies; works in RN/Expo environment.
 * SPORT: T-P3-E5-W3-S1-T01-c typed errors
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Map over the Ok value; pass through Err unchanged.
 */
export function mapOk<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}
