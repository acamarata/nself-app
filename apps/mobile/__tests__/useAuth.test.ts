/**
 * Purpose: Smoke tests for useAuth hook — sign-in flow, sign-out, loading state
 * Inputs: mocked expo-secure-store and fetch
 * Outputs: jest assertions on hook state transitions
 * Constraints: Runs under jest-expo preset; no native modules
 * SPORT: T-E1-05
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock expo-secure-store before importing the hook
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../src/hooks/useAuth';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  it('starts with loading true then resolves with no token', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBeNull();
  });

  it('loads stored token and serverUrl on mount', async () => {
    // getServerUrl() calls getItemAsync(SERVER_URL_KEY) first in Promise.all,
    // then getItemAsync(TOKEN_KEY) — mock order must match.
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('https://api.example.com') // 1st: SERVER_URL_KEY via getServerUrl()
      .mockResolvedValueOnce('test-token');              // 2nd: TOKEN_KEY direct call

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.accessToken).toBe('test-token'));
    expect(result.current.serverUrl).toBe('https://api.example.com');
  });

  it('signIn stores tokens on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
      }),
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false)); // initial load

    await act(async () => {
      await result.current.signIn('https://api.example.com', 'user@example.com', 'pass');
    });

    expect(result.current.accessToken).toBe('new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ntask_access_token', 'new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ntask_refresh_token', 'new-refresh');
  });

  it('signOut clears tokens', async () => {
    // Same call order as above: SERVER_URL_KEY first, TOKEN_KEY second.
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('https://api.example.com') // 1st: SERVER_URL_KEY via getServerUrl()
      .mockResolvedValueOnce('stored-token');            // 2nd: TOKEN_KEY direct call

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.accessToken).toBe('stored-token'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ntask_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ntask_refresh_token');
  });
});
