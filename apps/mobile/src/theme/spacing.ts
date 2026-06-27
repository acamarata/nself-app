/**
 * Purpose: 4px-grid spacing tokens for ɳTask mobile.
 * Use via useTheme().spacing. Never hardcode pixel values.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type Spacing = typeof spacing;
