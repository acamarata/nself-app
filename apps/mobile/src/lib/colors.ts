/**
 * Purpose: Shared list-colour parsing — validates the hex colour stored on
 *          np_lists before it reaches a style prop, with a single fallback.
 * Inputs: hex string as stored on NpList.color (may be null/invalid legacy data).
 * Outputs: A usable #RRGGBB string; falls back to the app's indigo brand colour.
 * Constraints:
 *   - Same validation + fallback previously duplicated per-screen (HomeScreen);
 *     extracted so HomeScreen and the calendar agree on one fallback (DRY, ASI §3).
 *   - Intentionally accepts only 6-digit RGB; the list editor only writes that form.
 * SPORT: MB-4 calendar view (shared with HomeScreen list cards)
 */

const FALLBACK_COLOR = '#6366f1';
const HEX_RGB = /^#[0-9A-Fa-f]{6}$/;

/** Return the hex colour if valid, else the shared fallback colour. */
export function parseColor(hex: string | null | undefined): string {
  return typeof hex === 'string' && HEX_RGB.test(hex) ? hex : FALLBACK_COLOR;
}
