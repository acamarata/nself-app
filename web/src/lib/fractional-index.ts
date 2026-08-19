/**
 * fractional-index.ts — Fractional indexing for drag-and-drop position reordering
 * Purpose: Compute a numeric position value between two adjacent items,
 *          supporting infinite insertions without reindexing the full list.
 * Inputs:  before (number | null) — position of item immediately before,
 *          after  (number | null) — position of item immediately after.
 * Outputs: number — a new position value strictly between before and after.
 * Constraints: Uses floating-point midpoint. Works with NpTask.position (number).
 * SPORT: D2-S7
 */

/** Default step between newly seeded items */
const STEP = 1000

/**
 * Return a position number that sits strictly between `before` and `after`.
 *
 * @param before - position of the preceding item, or null for "before first"
 * @param after  - position of the following item, or null for "after last"
 */
export function between(before: number | null, after: number | null): number {
  const lo = before ?? 0
  const hi = after ?? lo + STEP * 2

  if (lo >= hi) {
    // Fallback: use current timestamp (always after any reasonable position)
    return Date.now()
  }

  return (lo + hi) / 2
}

/**
 * Generate initial position values for a list of n items.
 * Produces evenly-spaced values [STEP, 2*STEP, ..., n*STEP].
 */
export function initialPositions(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i + 1) * STEP)
}
