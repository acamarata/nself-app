/**
 * Purpose: Auth state management — server URL, access token, sign-in/out
 * Inputs: serverUrl, email, password via sign-in form
 * Outputs: { serverUrl, accessToken, user, signIn, signOut, loading, error }
 * Constraints: Token stored in SecureStore; server URL persisted across sessions
 * SPORT: Port of Flutter AuthNotifier + BackendService auth helpers
 */

import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getServerUrl, setServerUrl } from '../lib/api';

const TOKEN_KEY = 'ntask_access_token';
const REFRESH_KEY = 'ntask_refresh_token';

interface AuthState {
  serverUrl: string | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    serverUrl: null,
    accessToken: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      const [url, token] = await Promise.all([
        getServerUrl(),
        SecureStore.getItemAsync(TOKEN_KEY),
      ]);
      setState({ serverUrl: url, accessToken: token, loading: false, error: null });
    })();
  }, []);

  const signIn = useCallback(async (url: string, email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const cleanUrl = url.trim().replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/v1/auth/email/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const json = await res.json() as { session: { accessToken: string; refreshToken: string } };
      await setServerUrl(cleanUrl);
      await SecureStore.setItemAsync(TOKEN_KEY, json.session.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, json.session.refreshToken);
      setState({ serverUrl: cleanUrl, accessToken: json.session.accessToken, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setState({ serverUrl: state.serverUrl, accessToken: null, loading: false, error: null });
  }, [state.serverUrl]);

  return { ...state, signIn, signOut };
}
