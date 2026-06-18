/**
 * Purpose: Smoke tests for useAuth hook — sign-in flow, sign-out, loading state
 * Inputs: mocked expo-secure-store, @nself/auth-core createNativeAuthStrategy, and fetch
 * Outputs: jest assertions on hook state transitions
 * Constraints: Runs under jest-expo preset; no native modules.
 *   auth-core API: createNativeAuthStrategy(store, config), strategy.init(), .login(), .logout(), .subscribe()
 *   AuthState discriminated union: loading | unauthenticated | authenticated{jwt} | error{error}
 * SPORT: T-E1-05 (updated for SDK 53 / @nself/auth-core wiring)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock expo-secure-store before imports
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock api.ts helpers to control serverUrl persistence
jest.mock('../src/lib/api', () => ({
  getServerUrl: jest.fn().mockResolvedValue(null),
  setServerUrl: jest.fn().mockResolvedValue(undefined),
  createUrqlClient: jest.fn(),
}));

// Mock @nself/auth-core — jest.mock factory must not reference out-of-scope variables.
// Strategy state is shared via module-level storage accessed by the factory.
jest.mock('@nself/auth-core', () => {
  const subscribers: Array<(s: unknown) => void> = [];
  const strategy = {
    _subscribers: subscribers,
    init: jest.fn().mockResolvedValue({ status: 'unauthenticated' }),
    login: jest.fn().mockResolvedValue({ status: 'unauthenticated' }),
    logout: jest.fn().mockResolvedValue({ status: 'unauthenticated' }),
    getAccessToken: jest.fn().mockReturnValue(null),
    subscribe: jest.fn().mockImplementation((cb: (s: unknown) => void) => {
      subscribers.push(cb);
      return () => {
        const idx = subscribers.indexOf(cb);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    }),
  };
  return {
    __strategy: strategy,
    createNativeAuthStrategy: jest.fn().mockReturnValue(strategy),
  };
});

import * as apiModule from '../src/lib/api';
import * as authCore from '@nself/auth-core';
import { useAuth } from '../src/hooks/useAuth';

// Access shared strategy through the module mock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMockStrategy = () => (authCore as any).__strategy as {
  _subscribers: Array<(s: unknown) => void>;
  init: jest.Mock;
  login: jest.Mock;
  logout: jest.Mock;
  getAccessToken: jest.Mock;
  subscribe: jest.Mock;
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const strategy = getMockStrategy();
    strategy._subscribers.length = 0;
    strategy.init.mockResolvedValue({ status: 'unauthenticated' });
    strategy.login.mockResolvedValue({ status: 'unauthenticated' });
    strategy.logout.mockResolvedValue({ status: 'unauthenticated' });
    (apiModule.getServerUrl as jest.Mock).mockResolvedValue(null);
  });

  it('starts with loading true then resolves with no token when no serverUrl', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBeNull();
  });

  it('loads stored serverUrl and initialises auth-core on mount', async () => {
    (apiModule.getServerUrl as jest.Mock).mockResolvedValueOnce('https://api.example.com');
    const strategy = getMockStrategy();
    strategy.init.mockResolvedValueOnce({
      status: 'authenticated',
      jwt: 'stored-token',
      user: { id: 'u1', email: 'test@example.com', defaultRole: 'user', roles: ['user'], displayName: null, avatarUrl: null, locale: 'en' },
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.accessToken).toBe('stored-token'));
    expect(result.current.serverUrl).toBe('https://api.example.com');
    expect(result.current.loading).toBe(false);
  });

  it('signIn calls auth-core login and updates state', async () => {
    const strategy = getMockStrategy();
    strategy.login.mockResolvedValueOnce({
      status: 'authenticated',
      jwt: 'new-access',
      user: { id: 'u1', email: 'user@example.com', defaultRole: 'user', roles: ['user'], displayName: null, avatarUrl: null, locale: 'en' },
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('https://api.example.com', 'user@example.com', 'pass');
    });

    await waitFor(() => expect(result.current.accessToken).toBe('new-access'));
    expect(apiModule.setServerUrl).toHaveBeenCalledWith('https://api.example.com');
    expect(strategy.login).toHaveBeenCalledWith('user@example.com', 'pass');
  });

  it('signOut clears access token via strategy.logout()', async () => {
    (apiModule.getServerUrl as jest.Mock).mockResolvedValueOnce('https://api.example.com');
    const strategy = getMockStrategy();
    strategy.init.mockResolvedValueOnce({
      status: 'authenticated',
      jwt: 'stored-token',
      user: { id: 'u1', email: 'test@example.com', defaultRole: 'user', roles: ['user'], displayName: null, avatarUrl: null, locale: 'en' },
    });
    strategy.logout.mockResolvedValueOnce({ status: 'unauthenticated' });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.accessToken).toBe('stored-token'));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.accessToken).toBeNull());
    expect(strategy.logout).toHaveBeenCalled();
  });
});
