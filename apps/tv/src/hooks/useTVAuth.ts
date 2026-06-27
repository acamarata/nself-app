/**
 * Purpose: Auth state management for ɳTask TV — server URL + JWT token lifecycle.
 * Inputs: serverUrl, email, password via ConnectScreen form.
 * Outputs: { serverUrl, accessToken, loading, error, signIn, signOut }
 * Constraints:
 *   - Mirrors mobile useAuth.ts pattern exactly; uses @nself/auth-core NativeAuthStrategy.
 *   - Storage: expo-secure-store (available on tvOS and Android TV via Expo).
 *     On platforms where SecureStore is unavailable, falls back gracefully to null token.
 *   - Server URL persisted independently from JWT (self-hosted install flexibility).
 *   - TV-specific: no biometrics, no FaceID — username/password only on Connect screen.
 * SPORT: Epic F — TV scaffold.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  createNativeAuthStrategy,
  type AuthStrategy,
  type AuthState as CoreAuthState,
  type SecureStoreInterface,
} from '@nself/auth-core';
import { getServerUrl, setServerUrl } from '../lib/api';

const secureStoreAdapter: SecureStoreInterface = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  delete: (key: string) => SecureStore.deleteItemAsync(key),
};

export interface UseTVAuthResult {
  serverUrl: string | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  signIn: (url: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useTVAuth(): UseTVAuthResult {
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [coreState, setCoreState] = useState<CoreAuthState>({ status: 'loading' });
  const strategyRef = useRef<AuthStrategy | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const accessToken = coreState.status === 'authenticated' ? coreState.jwt : null;
  const loading = coreState.status === 'loading';
  const error = coreState.status === 'error' ? coreState.error.message : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await getServerUrl();
      if (cancelled) return;
      setServerUrlState(url);

      if (url) {
        const strategy = createNativeAuthStrategy(secureStoreAdapter, {
          authBaseUrl: `${url}/v1/auth`,
        });
        strategyRef.current = strategy;
        unsubRef.current = strategy.subscribe((state) => {
          if (!cancelled) setCoreState(state);
        });
        const initialState = await strategy.init();
        if (!cancelled) setCoreState(initialState);
      } else {
        setCoreState({ status: 'unauthenticated' });
      }
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, []);

  const signIn = useCallback(async (url: string, email: string, password: string) => {
    setCoreState({ status: 'loading' });
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      await setServerUrl(cleanUrl);
      setServerUrlState(cleanUrl);

      unsubRef.current?.();

      const strategy = createNativeAuthStrategy(secureStoreAdapter, {
        authBaseUrl: `${cleanUrl}/v1/auth`,
      });
      strategyRef.current = strategy;
      unsubRef.current = strategy.subscribe(setCoreState);

      const result = await strategy.login(email, password);
      setCoreState(result);
    } catch {
      setCoreState({ status: 'unauthenticated' });
    }
  }, []);

  const signOut = useCallback(async () => {
    const strategy = strategyRef.current;
    if (strategy) {
      const result = await strategy.logout();
      setCoreState(result);
    }
  }, []);

  return { serverUrl, accessToken, loading, error, signIn, signOut };
}
