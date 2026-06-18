/**
 * Purpose: Auth state management — server URL, access token, sign-in/out
 * Inputs: serverUrl, email, password via sign-in form
 * Outputs: { serverUrl, accessToken, loading, error, signIn, signOut }
 * Constraints: Uses @nself/auth-core NativeAuthStrategy (SecureStore + JWT refresh loop).
 *   - AuthState shape: loading | unauthenticated | authenticated{jwt} | error{error}
 *   - The server URL is persisted separately (not part of auth-core) for self-hosted installs.
 *   - NativeAuthStrategy API: init(), login(email, pw), logout(), subscribe(listener), getAccessToken()
 *   - createNativeAuthStrategy(store, config, fetchFn) — positional args (not object)
 * SPORT: Replaces hand-rolled auth; wraps @nself/auth-core (D-P3-REACT19 / E2 wiring)
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

/** SecureStore adapter satisfying @nself/auth-core SecureStoreInterface (get/set/delete) */
const secureStoreAdapter: SecureStoreInterface = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  delete: (key: string) => SecureStore.deleteItemAsync(key),
};

interface UseAuthResult {
  serverUrl: string | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  signIn: (url: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [coreState, setCoreState] = useState<CoreAuthState>({ status: 'loading' });
  const strategyRef = useRef<AuthStrategy | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Derive accessToken from CoreAuthState — only 'authenticated' status has jwt
  const accessToken = coreState.status === 'authenticated' ? coreState.jwt : null;
  const loading = coreState.status === 'loading';
  const error = coreState.status === 'error' ? coreState.error.message : null;

  // On mount: load persisted server URL + initialise auth-core strategy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await getServerUrl();
      if (cancelled) return;
      setServerUrlState(url);

      if (url) {
        const strategy = createNativeAuthStrategy(
          secureStoreAdapter,
          { authBaseUrl: `${url}/v1/auth` },
        );
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

      // Unsubscribe from previous strategy if any
      unsubRef.current?.();

      const strategy = createNativeAuthStrategy(
        secureStoreAdapter,
        { authBaseUrl: `${cleanUrl}/v1/auth` },
      );
      strategyRef.current = strategy;
      unsubRef.current = strategy.subscribe(setCoreState);

      const result = await strategy.login(email, password);
      setCoreState(result);
    } catch (e) {
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

  return {
    serverUrl,
    accessToken,
    loading,
    error,
    signIn,
    signOut,
  };
}
