/**
 * Purpose: Persisted app settings — server URL, language, appearance preference.
 * serverUrl proxies to lib/api.ts's SecureStore-backed getServerUrl/setServerUrl
 * (the same key useAuth reads to build the urql client) so changing it here is
 * never cosmetic — it is the single source of truth for the backend endpoint.
 * language/appearance stay MMKV-backed (non-sensitive UI prefs).
 * Constraints: All setting mutations persist immediately. serverUrl starts as ''
 *   and is filled in asynchronously once SecureStore resolves (see useEffect).
 * Inputs: none (reads from SecureStore + MMKV on init)
 * Outputs: { serverUrl, setServerUrl, language, setLanguage, appearance, setAppearance }
 * SPORT: C-S3-T1
 */
import { useState, useCallback, useEffect } from 'react';
import { MMKV } from 'react-native-mmkv';
import { getServerUrl, setServerUrl as persistServerUrl } from '../lib/api';

export type AppLanguage = 'en' | 'ar' | 'fr' | 'es';
export type AppAppearance = 'system' | 'light' | 'dark';

const storage = new MMKV({ id: 'ntask-settings' });

const KEYS = {
  LANGUAGE: 'language',
  APPEARANCE: 'appearance',
} as const;

export interface UseSettingsResult {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  appearance: AppAppearance;
  setAppearance: (a: AppAppearance) => void;
}

function getStr(key: string, fallback: string): string {
  return storage.getString(key) ?? fallback;
}

export function useSettings(): UseSettingsResult {
  const [serverUrl, setServerUrlState] = useState('');
  const [language, setLanguageState] = useState<AppLanguage>(() => getStr(KEYS.LANGUAGE, 'en') as AppLanguage);
  const [appearance, setAppearanceState] = useState<AppAppearance>(() => getStr(KEYS.APPEARANCE, 'system') as AppAppearance);

  // Load the persisted server URL from SecureStore on mount. Async by nature —
  // callers see '' until this resolves, matching the previous MMKV-backed
  // default while now reading the real value auth/api.ts will use.
  useEffect(() => {
    let cancelled = false;
    void getServerUrl().then((url) => {
      if (!cancelled) setServerUrlState(url ?? '');
    });
    return () => { cancelled = true; };
  }, []);

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url);
    void persistServerUrl(url);
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    storage.set(KEYS.LANGUAGE, lang);
    setLanguageState(lang);
  }, []);

  const setAppearance = useCallback((a: AppAppearance) => {
    storage.set(KEYS.APPEARANCE, a);
    setAppearanceState(a);
  }, []);

  return { serverUrl, setServerUrl, language, setLanguage, appearance, setAppearance };
}
