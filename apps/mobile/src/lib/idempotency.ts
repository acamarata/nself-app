/**
 * Purpose: Idempotency key generation for task mutations
 * Inputs: Mutation type string + client-controlled seed (e.g. list ID + title + timestamp bucket)
 * Outputs: Deterministic idempotency key string (UUID-like, collision-resistant)
 * Constraints: No native crypto — uses simple string hash compatible with Hermes JS engine.
 *   Keys are per-session-bucketed: same inputs within a 5-minute window = same key (dedup window).
 * SPORT: T-P3-E5-W3-S1-T01-c idempotency
 */

/**
 * FNV-1a 32-bit hash — fast, no deps, Hermes-compatible.
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Simulate 32-bit unsigned multiply
    hash = (Math.imul(hash, 0x01000193) >>> 0);
  }
  return hash >>> 0;
}

function toHex(n: number): string {
  return n.toString(16).padStart(8, '0');
}

/**
 * Generate an idempotency key.
 * @param mutationType - e.g. 'create_task', 'update_task', 'delete_task'
 * @param seed - deterministic seed (e.g. listId + title or task ID)
 * @param windowMs - dedup window in ms (default 5 minutes)
 */
export function generateIdempotencyKey(
  mutationType: string,
  seed: string,
  windowMs = 5 * 60 * 1000,
): string {
  const bucket = Math.floor(Date.now() / windowMs);
  const payload = `${mutationType}:${seed}:${bucket}`;
  const h1 = fnv1a(payload);
  const h2 = fnv1a(payload + ':2');
  const h3 = fnv1a(payload + ':3');
  const h4 = fnv1a(payload + ':4');
  // Format as UUID v4-ish (not cryptographically random, but collision-resistant for dedup)
  return `${toHex(h1)}-${toHex(h2).slice(0, 4)}-4${toHex(h2).slice(1, 4)}-${toHex(h3).slice(0, 4)}-${toHex(h3).slice(4)}${toHex(h4)}`;
}
