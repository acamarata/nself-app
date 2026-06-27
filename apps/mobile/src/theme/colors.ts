/**
 * Purpose: Centralized color tokens for ɳTask — light, dark, and high-contrast palettes.
 * All screens and components MUST use these tokens, never hardcoded hex values.
 * Constraints: All text/background pairs MUST meet WCAG 2.1 AA (4.5:1 text, 3:1 UI).
 */
export const lightColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceElevated: '#FFFFFF',
  border: '#E5E7EB',
  borderSubtle: '#F3F4F6',
  text: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  textOnPrimary: '#FFFFFF',
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primarySubtle: '#EEF2FF',
  success: '#10B981',
  successSubtle: '#D1FAE5',
  warning: '#F59E0B',
  warningSubtle: '#FEF3C7',
  danger: '#EF4444',
  dangerSubtle: '#FEE2E2',
  priorityLow: '#3B82F6',
  priorityMedium: '#F59E0B',
  priorityHigh: '#F97316',
  priorityUrgent: '#EF4444',
  priorityNone: '#9CA3AF',
  skeleton: '#E5E7EB',
  skeletonHighlight: '#F9FAFB',
  offline: '#F3F4F6',
  shadow: '#000000',
} as const;

export const darkColors = {
  background: '#030712',
  surface: '#111827',
  surfaceElevated: '#1F2937',
  border: '#374151',
  borderSubtle: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textTertiary: '#6B7280',
  textDisabled: '#4B5563',
  textOnPrimary: '#FFFFFF',
  primary: '#818CF8',
  primaryHover: '#6366F1',
  primarySubtle: '#1E1B4B',
  success: '#34D399',
  successSubtle: '#064E3B',
  warning: '#FCD34D',
  warningSubtle: '#451A03',
  danger: '#F87171',
  dangerSubtle: '#450A0A',
  priorityLow: '#60A5FA',
  priorityMedium: '#FCD34D',
  priorityHigh: '#FB923C',
  priorityUrgent: '#F87171',
  priorityNone: '#6B7280',
  skeleton: '#1F2937',
  skeletonHighlight: '#374151',
  offline: '#1F2937',
  shadow: '#000000',
} as const;

/** Structural color token type — all keys present in both light and dark palettes. */
export type ColorTokens = { [K in keyof typeof lightColors]: string };
