/**
 * Purpose: Persisted app settings — server URL, language, appearance preference, notification prefs.
 * Backed by react-native-mmkv. Changes take effect without restart except RTL (language=ar).
 * Constraints: All setting mutations update MMKV immediately.
 * Inputs: none (reads from MMKV on init)
 * Outputs: { serverUrl, setServerUrl, language, setLanguage, appearance, setAppearance }
 */
import { useState, useCallback } from 'react';
import { MMKV } from 'react-native-mmkv';

export type AppLanguage = 'en' | 'ar' | 'fr' | 'es';
export type AppAppearance = 'system' | 'light' | 'dark';

const storage = new MMKV({ id: 'ntask-settings' });

const KEYS = {
  SERVER_URL: 'serverUrl',
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
  const [serverUrl, setServerUrlState] = useState(() => getStr(KEYS.SERVER_URL, ''));
  const [language, setLanguageState] = useState<AppLanguage>(() => getStr(KEYS.LANGUAGE, 'en') as AppLanguage);
  const [appearance, setAppearanceState] = useState<AppAppearance>(() => getStr(KEYS.APPEARANCE, 'system') as AppAppearance);

  const setServerUrl = useCallback((url: string) => {
    storage.set(KEYS.SERVER_URL, url);
    setServerUrlState(url);
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
