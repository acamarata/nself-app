/**
 * Purpose: Smoke tests for useAuth hook — sign-in flow, sign-out, loading state
 * Inputs: mocked expo-secure-store and fetch
 * Outputs: jest assertions on hook state transitions
 * Constraints: Runs under jest-expo preset; no native modules
 * SPORT: T-E1-05
 */

import { renderHook, act } from '@testing-library/react-hooks';

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
    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();
    expect(result.current.loading).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });

  it('loads stored token and serverUrl on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('test-token')
      .mockResolvedValueOnce('https://api.example.com');

    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    await waitForNextUpdate();
    expect(result.current.accessToken).toBe('test-token');
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

    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    await waitForNextUpdate(); // initial load

    await act(async () => {
      await result.current.signIn('https://api.example.com', 'user@example.com', 'pass');
    });

    expect(result.current.accessToken).toBe('new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ntask_access_token', 'new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ntask_refresh_token', 'new-refresh');
  });

  it('signOut clears tokens', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('stored-token')
      .mockResolvedValueOnce('https://api.example.com');

    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ntask_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ntask_refresh_token');
  });
});
