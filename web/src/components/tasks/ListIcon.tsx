/**
 * ListIcon.tsx — Renders a np_lists.icon key as an actual icon glyph.
 *
 * Purpose:     np_lists.icon stores a short key (e.g. "sun", "briefcase") —
 *              this maps known keys to inline SVG glyphs so list badges show
 *              a real icon instead of the raw key text (seed data + any future
 *              icon picker both write these same keys).
 * Inputs:      icon?: string | null (np_lists.icon), title: string (fallback
 *              source for the initial-letter badge when the key is unknown).
 * Outputs:     A single SVG icon, or the list's first letter uppercased when
 *              `icon` is missing/unrecognized (unchanged prior behavior).
 * Constraints: No icon library dependency — inline SVG paths only, sized to
 *              fill the existing 40x40 ListCard badge (h-5 w-5 glyph, white
 *              stroke to match the colored background).
 * SPORT: D2-icon-key-render-fix (ntask app-dogfood item #4).
 */
const ICON_PATHS: Record<string, string> = {
  // Today / general-purpose — sun
  sun: 'M8 3v1.5M8 11.5V13M3 8H4.5M11.5 8H13M4.6 4.6l1.06 1.06M10.34 10.34l1.06 1.06M11.4 4.6l-1.06 1.06M5.66 10.34L4.6 11.4M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  // Work — briefcase
  briefcase: 'M2.5 6.5h11a1 1 0 011 1V13a1 1 0 01-1 1h-11a1 1 0 01-1-1V7.5a1 1 0 011-1zM5.5 6.5V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0110.5 5v1.5M2 9.5h12',
  // Personal — user
  user: 'M8 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3.5 13c0-2.485 2.015-4 4.5-4s4.5 1.515 4.5 4',
  // Shopping — cart
  cart: 'M2 2h1.5l1.3 7.5h6.9L13 4.5H4.1M6 13a1 1 0 100-2 1 1 0 000 2zM11 13a1 1 0 100-2 1 1 0 000 2z',
  // Extra common keys for any future/manual seed usage
  home: 'M2.5 8L8 3.5 13.5 8M4 6.8V13h8V6.8',
  star: 'M8 2.5l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z',
  heart: 'M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.8a2.7 2.7 0 015.5 1.4c0 3.8-5.5 7.3-5.5 7.3z',
  flag: 'M3.5 2.5v11M3.5 3h7l-1.5 2.5L10.5 8h-7',
};

export interface ListIconProps {
  /** np_lists.icon value — a short key like "sun", or null/undefined. */
  icon?: string | null;
  /** List title, used for the fallback initial-letter badge. */
  title: string;
  /** Extra classes for the SVG element (defaults sized for the 40x40 badge). */
  className?: string;
}

/** Renders the icon glyph for a known key, or a fallback letter badge. */
export function ListIcon({ icon, title, className }: ListIconProps) {
  const path = icon ? ICON_PATHS[icon] : undefined;

  if (!path) {
    return <>{icon || title[0]?.toUpperCase() || '?'}</>;
  }

  return (
    <svg
      className={className ?? 'h-5 w-5'}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
