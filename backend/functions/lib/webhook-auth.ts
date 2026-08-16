// Purpose: Shared-secret authentication for the functions webhook listener.
// Inputs: the configured secret (NHOST_WEBHOOK_SECRET) and the request headers.
// Outputs: a boolean verdict, decided in constant time.
//
// Constraints:
//   - Handlers trust `session_variables['x-hasura-user-id']` in the request body as
//     proven identity, because Hasura derives it from a verified JWT. Nothing
//     downstream re-checks it, so anything that can reach the port can impersonate
//     any user. This module is what makes "only Hasura can reach it" true.
//   - Comparison must not leak the expected secret through timing, so it always
//     runs a timingSafeEqual even when the lengths differ.
//   - With no secret configured the check cannot run. It reports "authorised" so an
//     existing deployment does not go dark on upgrade; server.ts logs a loud boot
//     warning instead. Configure the secret in every environment.
//
// SPORT: F08 backend functions

import { timingSafeEqual } from 'crypto';

/** Header Hasura sends the shared secret in (see hasura/metadata/actions.yaml). */
export const WEBHOOK_HEADER = 'x-nself-webhook-secret';

/** Constant-time comparison that does not reveal length through an early return. */
export function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Burn an equivalent comparison so a length mismatch is not measurably faster.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Read the secret header out of a Node request-headers bag. */
export function readSecretHeader(
  headers: Record<string, string | string[] | undefined>
): string {
  const header = headers[WEBHOOK_HEADER];
  if (Array.isArray(header)) return header[0] ?? '';
  return header ?? '';
}

/**
 * Decide whether a caller may invoke a handler.
 *
 * @param headers request headers, lowercased as Node delivers them
 * @param expected the configured secret; an empty value disables the check
 */
export function isAuthorisedCaller(
  headers: Record<string, string | string[] | undefined>,
  expected: string
): boolean {
  if (!expected) return true;
  return secretMatches(readSecretHeader(headers), expected);
}
