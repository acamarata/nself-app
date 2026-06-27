/**
 * Purpose: 10-foot UI theme tokens for ɳTask TV.
 * Inputs: none
 * Outputs: TVTheme object with type scale, spacing, color palette (light+dark), focus ring.
 * Constraints:
 *   - All interactive text ≥ 48px (10-foot UX minimum; Apple TV HIG recommends 60px for primary text).
 *   - Focus ring: 4px solid brand color + drop shadow for visibility on any background.
 *   - High-contrast palette: foreground ≥ 7:1 contrast ratio against dark background (WCAG AAA).
 *   - Colors are CSS-like hex strings — compatible with React Native StyleSheet color values.
 *   - No animation values here; those live in src/navigation/FocusContext.tsx animation constants.
 * SPORT: Epic F — TV scaffold.
 */

/** Typographic scale — all sizes assume a 75" display at 3m viewing distance. */
export const typeScale = {
  /** Primary headings — screen titles, section headers */
  heading1: 72,
  /** Secondary headings — group labels, card titles */
  heading2: 56,
  /** Card titles, task titles in list view */
  heading3: 48,
  /** Body text — task descriptions, metadata */
  body: 40,
  /** Secondary/supporting text — dates, tags, counts */
  caption: 34,
  /** Hint text — remote control hints */
  hint: 28,
} as const;

/** Spacing scale — multiples of 8px base unit. */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 40,
  xl: 64,
  xxl: 96,
} as const;

/** Border radius — generous curves for TV aesthetics. */
export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Focus ring definition — applied by TVFocusable on focus state. */
export const focusRing = {
  borderWidth: 4,
  /** Absolute inset so the ring sits outside the component bounds. */
  outlineOffset: 4,
  /** Shadow spread for extra depth on dark backgrounds. */
  shadowRadius: 12,
  shadowOpacity: 0.6,
} as const;

/** Dark palette — primary surface for TV (dark rooms / OLED screens). */
export const darkColors = {
  /** App background */
  background: '#030712',
  /** Card / elevated surface */
  surface: '#111827',
  /** Secondary surface — sidebar, modals */
  surfaceSecondary: '#1F2937',
  /** Primary brand — indigo */
  brand: '#818CF8',
  /** Focus ring / active accent */
  focus: '#A5B4FC',
  /** Primary text — near-white for contrast */
  textPrimary: '#F9FAFB',
  /** Secondary text — muted labels, captions */
  textSecondary: '#9CA3AF',
  /** Disabled text */
  textDisabled: '#4B5563',
  /** Success / done state */
  success: '#34D399',
  /** Warning — overdue tasks */
  warning: '#FBBF24',
  /** Error / destructive */
  error: '#F87171',
  /** Dividers and borders */
  border: '#374151',
  /** Mark-done button background */
  doneButton: '#059669',
  /** Focus ring shadow color */
  focusShadow: '#818CF8',
} as const;

/** Light palette — included for completeness; TV UI defaults to dark. */
export const lightColors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  brand: '#4F46E5',
  focus: '#6366F1',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#D1D5DB',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  border: '#E5E7EB',
  doneButton: '#059669',
  focusShadow: '#4F46E5',
} as const;

export type TVColors = typeof darkColors;

/** Priority color map — consistent with mobile app. */
export const priorityColors: Record<string, string> = {
  urgent: '#F87171',
  high: '#FBBF24',
  normal: '#60A5FA',
  low: '#9CA3AF',
};

/** Full TV theme — always dark (TV default). Caller may override with light for accessibility modes. */
export const tvTheme = {
  typeScale,
  spacing,
  radius,
  focusRing,
  colors: darkColors,
  priorityColors,
} as const;

export type TVTheme = typeof tvTheme;
