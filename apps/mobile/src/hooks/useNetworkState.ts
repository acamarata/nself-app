/**
 * Purpose: React hook wrapping @react-native-community/netinfo for network state detection
 * Inputs: None (subscribes to system network events)
 * Outputs: { isConnected, isInternetReachable, wasOffline } + onReconnect callback support
 * Constraints:
 *   - Exposes isConnected (device has a network interface) and isInternetReachable (can reach internet).
 *   - wasOffline flag: true when the app has been offline this session; used to trigger queue sync.
 *   - Calls onReconnect() when transitioning from offline → online.
 *   - Falls back gracefully to isConnected=true if NetInfo is unavailable (Expo Go without native build).
 * SPORT: T-P3-E5-W3-S1-T01-a NetInfo hook
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface NetworkState {
  /** Device has a network interface (may or may not have internet) */
  isConnected: boolean;
  /** Can reach internet — may be null while determining */
  isInternetReachable: boolean | null;
  /** True if app has been offline at any point this session */
  wasOffline: boolean;
}

interface UseNetworkStateOptions {
  /** Called once when transitioning from offline → online */
  onReconnect?: () => void | Promise<void>;
}

export function useNetworkState(options?: UseNetworkStateOptions): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    wasOffline: false,
  });
  const onReconnect = options?.onReconnect;
  const prevConnected = useRef(true);
  const hasBeenOffline = useRef(false);

  const handleStateChange = useCallback(
    (netState: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      const connected = netState.isConnected ?? true;

      if (!connected && !hasBeenOffline.current) {
        hasBeenOffline.current = true;
      }

      if (connected && !prevConnected.current) {
        // Reconnected — trigger sync
        onReconnect?.();
      }

      prevConnected.current = connected;
      setState({
        isConnected: connected,
        isInternetReachable: netState.isInternetReachable,
        wasOffline: hasBeenOffline.current,
      });
    },
    [onReconnect],
  );

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      // Dynamic import — avoids hard crash in Expo Go
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo').default as {
        addEventListener: (
          handler: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void,
        ) => () => void;
        fetch: () => Promise<{ isConnected: boolean | null; isInternetReachable: boolean | null }>;
      };

      // Fetch initial state
      NetInfo.fetch().then(handleStateChange).catch(() => {
        // Best-effort — stay with default
      });

      unsubscribe = NetInfo.addEventListener(handleStateChange);
    } catch {
      // NetInfo native module not available — assume always connected
    }

    return () => {
      unsubscribe?.();
    };
  }, [handleStateChange]);

  return state;
}
