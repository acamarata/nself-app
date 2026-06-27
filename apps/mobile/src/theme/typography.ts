/**
 * Purpose: Typography scale for ɳTask — font sizes, weights, line heights.
 * Based on a 4px grid. Use via useTheme().typography.
 */
export const typography = {
  fontSizeXs: 11,
  fontSizeSm: 13,
  fontSizeBase: 15,
  fontSizeMd: 17,
  fontSizeLg: 20,
  fontSizeXl: 24,
  fontSizeXxl: 30,
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemibold: '600' as const,
  fontWeightBold: '700' as const,
  fontWeightExtrabold: '800' as const,
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
} as const;

export type Typography = typeof typography;
