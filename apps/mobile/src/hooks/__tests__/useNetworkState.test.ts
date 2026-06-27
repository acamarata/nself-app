/**
 * Purpose: Tests for useNetworkState hook — initial state, offline tracking, reconnect callback.
 * Inputs: NetInfo mock (auto-resolved from __mocks__/@react-native-community/netinfo.js)
 * Outputs: Verified hook behaviour for default state, wasOffline flag, and onReconnect trigger.
 * Constraints: Uses @testing-library/react-native renderHook + act; jest-expo preset; TS strict.
 * SPORT: T-P3-E5-W3-S1-T01-a NetInfo hook
 */

import NetInfo from '@react-native-community/netinfo';
import { renderHook, act } from '@testing-library/react-native';
import { useNetworkState } from '../useNetworkState';

// The __mocks__/@react-native-community/netinfo.js mock is wired via moduleNameMapper in
// jest.config.js — no explicit jest.mock() call needed here.

const netinfoMock = NetInfo as jest.Mocked<typeof NetInfo>;

// ── Helpers ───────────────────────────────────────────────────────────────────

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null };

/** Wire up addEventListener so we can drive listener calls in tests. */
function setupListener(): { triggerState: (s: NetState) => void } {
  let capturedListener: ((s: NetState) => void) | undefined;

  netinfoMock.addEventListener.mockImplementation((fn) => {
    capturedListener = fn as (s: NetState) => void;
    return () => {};
  });

  return {
    triggerState: (s: NetState) => {
      if (!capturedListener) throw new Error('addEventListener was not called');
      act(() => capturedListener!(s));
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: always-connected resolved value. Type cast to satisfy NetInfoState union.
  netinfoMock.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true } as any);
  netinfoMock.addEventListener.mockReturnValue(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNetworkState: initial state', () => {
  it('returns default state { isConnected: true, isInternetReachable: null, wasOffline: false }', () => {
    const { result } = renderHook(() => useNetworkState());

    // The synchronous initial state (before fetch resolves) uses the hook defaults.
    expect(result.current.isConnected).toBe(true);
    expect(result.current.wasOffline).toBe(false);
    // isInternetReachable starts as null until fetch resolves
    expect(result.current.isInternetReachable).toBeNull();
  });
});

describe('useNetworkState: wasOffline tracking', () => {
  it('wasOffline becomes true when isConnected transitions to false', async () => {
    const { triggerState } = setupListener();
    const { result } = renderHook(() => useNetworkState());

    expect(result.current.wasOffline).toBe(false);

    triggerState({ isConnected: false, isInternetReachable: false });

    expect(result.current.wasOffline).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });

  it('wasOffline remains true after reconnecting (session flag, not transient)', async () => {
    const { triggerState } = setupListener();
    const { result } = renderHook(() => useNetworkState());

    triggerState({ isConnected: false, isInternetReachable: false });
    expect(result.current.wasOffline).toBe(true);

    triggerState({ isConnected: true, isInternetReachable: true });
    expect(result.current.wasOffline).toBe(true);
  });
});

describe('useNetworkState: onReconnect callback', () => {
  it('calls onReconnect when transitioning from offline → online', async () => {
    const { triggerState } = setupListener();
    const onReconnect = jest.fn();

    const { result } = renderHook(() => useNetworkState({ onReconnect }));

    // Drive offline
    triggerState({ isConnected: false, isInternetReachable: false });
    expect(result.current.isConnected).toBe(false);
    expect(onReconnect).not.toHaveBeenCalled();

    // Drive back online
    triggerState({ isConnected: true, isInternetReachable: true });
    expect(result.current.isConnected).toBe(true);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('does not call onReconnect on the initial online state (no prior offline)', async () => {
    const { triggerState } = setupListener();
    const onReconnect = jest.fn();

    renderHook(() => useNetworkState({ onReconnect }));

    // Stays connected — no offline→online transition
    triggerState({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('does not call onReconnect when no callback is provided', async () => {
    const { triggerState } = setupListener();

    // Should not throw when onReconnect is undefined
    const { result } = renderHook(() => useNetworkState());

    triggerState({ isConnected: false, isInternetReachable: false });
    triggerState({ isConnected: true, isInternetReachable: true });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.wasOffline).toBe(true);
  });
});

describe('useNetworkState: unsubscribe on unmount', () => {
  it('calls the unsubscribe function returned by addEventListener on unmount', () => {
    const unsubscribe = jest.fn();
    netinfoMock.addEventListener.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useNetworkState());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
