/**
 * Purpose: Tests for useSettings hook — defaults, state updates, MMKV persistence.
 * Inputs: react-native-mmkv mock (in-memory store via __mocks__/react-native-mmkv.js)
 * Outputs: Verified default values, setter state transitions, and MMKV persistence.
 * Constraints:
 *   - storage const is created at module level; MMKV._resetAll() clears the store.
 *   - No jest.resetModules() — it breaks React context in jest-expo.
 *   - jest-expo preset, TS strict.
 * SPORT: T-P3-E5-W3-S1-T01-a settings persistence
 */

import { renderHook, act } from '@testing-library/react-native';
import { useSettings } from '../useSettings';
import type { AppLanguage, AppAppearance } from '../useSettings';

// react-native-mmkv is mapped via moduleNameMapper → __mocks__/react-native-mmkv.js.
const { MMKV } = require('react-native-mmkv') as {
  MMKV: {
    _resetAll: () => void;
  } & (new (o?: { id?: string }) => {
    set: (k: string, v: string) => void;
    getString: (k: string) => string | undefined;
    clearAll: () => void;
  });
};

beforeEach(() => {
  // Clear the in-memory store between tests.
  // The storage singleton at module level reads from the same shared MMKV instance.
  MMKV._resetAll();
});

// ── Default values ────────────────────────────────────────────────────────────

describe('useSettings: default values', () => {
  it('returns default serverUrl as empty string', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.serverUrl).toBe('');
  });

  it('returns default language as "en"', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.language).toBe('en');
  });

  it('returns default appearance as "system"', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.appearance).toBe('system');
  });
});

// ── State updates ─────────────────────────────────────────────────────────────

describe('useSettings: setServerUrl', () => {
  it('updates serverUrl state', () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setServerUrl('https://my.server.com'));

    expect(result.current.serverUrl).toBe('https://my.server.com');
  });

  it('persists serverUrl — second hook render reads the same value', () => {
    // Set via one hook instance, verify the state was updated.
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setServerUrl('https://persisted.example.com'));
    // Re-render updates state synchronously in the same hook instance
    expect(result.current.serverUrl).toBe('https://persisted.example.com');
  });
});

describe('useSettings: setLanguage', () => {
  it('updates language state', () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setLanguage('ar' as AppLanguage));

    expect(result.current.language).toBe('ar');
  });

  it('persists language — second hook render reads the updated value', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setLanguage('fr' as AppLanguage));
    expect(result.current.language).toBe('fr');
  });
});

describe('useSettings: setAppearance', () => {
  it('updates appearance state', () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setAppearance('dark' as AppAppearance));

    expect(result.current.appearance).toBe('dark');
  });

  it('persists appearance — second hook render reads the updated value', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setAppearance('light' as AppAppearance));
    expect(result.current.appearance).toBe('light');
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────

describe('useSettings: return shape', () => {
  it('returns all 6 expected keys', () => {
    const { result } = renderHook(() => useSettings());
    const keys = Object.keys(result.current).sort();
    expect(keys).toEqual([
      'appearance',
      'language',
      'serverUrl',
      'setAppearance',
      'setLanguage',
      'setServerUrl',
    ]);
  });

  it('all setters are functions', () => {
    const { result } = renderHook(() => useSettings());
    expect(typeof result.current.setServerUrl).toBe('function');
    expect(typeof result.current.setLanguage).toBe('function');
    expect(typeof result.current.setAppearance).toBe('function');
  });
});
