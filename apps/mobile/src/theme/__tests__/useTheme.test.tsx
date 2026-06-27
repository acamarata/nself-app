import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider, useTheme, lightColors, darkColors } from '../index';

describe('useTheme', () => {
  it('returns light colors by default', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider preference="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.background).toBe(lightColors.background);
  });

  it('returns dark colors when preference is dark', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider preference="dark">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.background).toBe(darkColors.background);
  });

  it('throws when used outside ThemeProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow();
    consoleSpy.mockRestore();
  });

  it('provides typography and spacing', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider preference="light">{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.typography.fontSizeBase).toBe(15);
    expect(result.current.spacing.base).toBe(16);
  });
});
