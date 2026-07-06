/**
 * Purpose: Tests for useSettings hook — serverUrl (SecureStore-backed via lib/api.ts),
 *   language/appearance (MMKV-backed) defaults, state updates, persistence.
 * Inputs: react-native-mmkv mock (in-memory store via __mocks__/react-native-mmkv.js);
 *   lib/api.ts getServerUrl/setServerUrl mocked so serverUrl is deterministic + synchronous
 *   in tests without a real SecureStore round-trip.
 * Outputs: Verified default values, setter state transitions, and persistence calls.
 * Constraints:
 *   - storage const is created at module level; MMKV._resetAll() clears the store.
 *   - No jest.resetModules() — it breaks React context in jest-expo.
 *   - jest-expo preset, TS strict.
 * SPORT: T-P3-E5-W3-S1-T01-a settings persistence / C-S3-T1
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockGetServerUrl = jest.fn().mockResolvedValue('');
const mockSetServerUrl = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/api', () => ({
  getServerUrl: (...args: unknown[]) => mockGetServerUrl(...args),
  setServerUrl: (...args: unknown[]) => mockSetServerUrl(...args),
}));

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
  mockGetServerUrl.mockClear().mockResolvedValue('');
  mockSetServerUrl.mockClear().mockResolvedValue(undefined);
});

// ── Default values ────────────────────────────────────────────────────────────

describe('useSettings: default values', () => {
  it('returns serverUrl as empty string before SecureStore resolves', async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.serverUrl).toBe('');
    // Flush the mount-time getServerUrl() promise so it doesn't resolve after the test ends.
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('loads the persisted serverUrl from lib/api.ts once SecureStore resolves', async () => {
    mockGetServerUrl.mockResolvedValue('https://loaded.example.com');
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.serverUrl).toBe('https://loaded.example.com'));
  });

  it('returns default language as "en"', async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.language).toBe('en');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('returns default appearance as "system"', async () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.appearance).toBe('system');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });
});

// ── State updates ─────────────────────────────────────────────────────────────

describe('useSettings: setServerUrl', () => {
  it('updates serverUrl state immediately (optimistic)', async () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setServerUrl('https://my.server.com'));

    expect(result.current.serverUrl).toBe('https://my.server.com');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('persists serverUrl through lib/api.ts setServerUrl (SecureStore), not MMKV', async () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setServerUrl('https://persisted.example.com'));
    expect(mockSetServerUrl).toHaveBeenCalledWith('https://persisted.example.com');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });
});

describe('useSettings: setLanguage', () => {
  it('updates language state', async () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setLanguage('ar' as AppLanguage));

    expect(result.current.language).toBe('ar');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('persists language — second hook render reads the updated value', async () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setLanguage('fr' as AppLanguage));
    expect(result.current.language).toBe('fr');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });
});

describe('useSettings: setAppearance', () => {
  it('updates appearance state', async () => {
    const { result } = renderHook(() => useSettings());

    act(() => result.current.setAppearance('dark' as AppAppearance));

    expect(result.current.appearance).toBe('dark');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('persists appearance — second hook render reads the updated value', async () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setAppearance('light' as AppAppearance));
    expect(result.current.appearance).toBe('light');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────

describe('useSettings: return shape', () => {
  it('returns all 6 expected keys', async () => {
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
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });

  it('all setters are functions', async () => {
    const { result } = renderHook(() => useSettings());
    expect(typeof result.current.setServerUrl).toBe('function');
    expect(typeof result.current.setLanguage).toBe('function');
    expect(typeof result.current.setAppearance).toBe('function');
    await waitFor(() => expect(mockGetServerUrl).toHaveBeenCalled());
  });
});
