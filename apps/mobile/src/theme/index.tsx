/**
 * Purpose: Central theme system for ɳTask mobile.
 * Exports: useTheme() hook returning { colors, typography, spacing, isDark, scheme }
 *          ThemeProvider wraps app with theme context.
 *          ThemePreference stored in MMKV ('system' | 'light' | 'dark').
 * Constraints: useColorScheme() drives automatic switching; MMKV override wins.
 * WCAG 2.1 AA enforced at token level — see colors.ts.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { lightColors, darkColors, type ColorTokens } from './colors';
import { typography, type Typography } from './typography';
import { spacing, type Spacing } from './spacing';

export { lightColors, darkColors };
export type { ColorTokens };

export type ThemePreference = 'system' | 'light' | 'dark';

const storage = new MMKV({ id: 'ntask-theme' });
const PREF_KEY = 'themePreference';

export function getThemePreference(): ThemePreference {
  return (storage.getString(PREF_KEY) as ThemePreference | undefined) ?? 'system';
}

export function setThemePreference(pref: ThemePreference): void {
  storage.set(PREF_KEY, pref);
}

export interface ThemeContextValue {
  colors: ColorTokens;
  typography: Typography;
  spacing: Spacing;
  isDark: boolean;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  preference?: ThemePreference;
  onPreferenceChange?: (p: ThemePreference) => void;
}

export function ThemeProvider({ children, preference = 'system', onPreferenceChange }: ThemeProviderProps) {
  const systemScheme = useColorScheme();

  const scheme = useMemo<'light' | 'dark'>(() => {
    if (preference === 'dark') return 'dark';
    if (preference === 'light') return 'light';
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    colors: scheme === 'dark' ? darkColors : lightColors,
    typography,
    spacing,
    isDark: scheme === 'dark',
    scheme,
    preference,
    setPreference: onPreferenceChange ?? (() => {}),
  }), [scheme, preference, onPreferenceChange]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
