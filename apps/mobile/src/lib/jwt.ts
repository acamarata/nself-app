/**
 * Purpose: Decode claims from a locally-held JWT access token without a network
 *          round-trip. Screens and hooks need the user id (`sub`) to parameterise
 *          the same explicit-userId GraphQL operations the web app uses.
 * Inputs:  A serialized JWT (header.payload.signature); the signature is never
 *          verified here — the token already came from the trusted auth store.
 * Outputs: decodeUserIdFromJwt(token) → the `sub` claim, or null when the token
 *          is absent/malformed.
 * Constraints: Pure + synchronous; must never throw (callers rely on the null
 *          fallback to pause queries rather than crash a screen).
 * SPORT: MB-2 notification centre — shared by useNotifications (same technique
 *        as ProfileScreen's email decode and usePushToken's sub decode).
 */

export function decodeUserIdFromJwt(accessToken: string | null): string | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
