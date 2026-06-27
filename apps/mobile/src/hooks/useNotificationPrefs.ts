/**
 * Purpose: Per-category notification preferences, persisted to MMKV.
 * Controls which push/local notification types the user receives.
 * Outputs: { prefs, setComments, setAssigned, setReminders, masterEnabled, setMasterEnabled }
 */
import { useState, useCallback } from 'react';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'ntask-notif-prefs' });

const KEYS = {
  MASTER: 'masterEnabled',
  COMMENTS: 'comments',
  ASSIGNED: 'assigned',
  REMINDERS: 'reminders',
} as const;

function getBool(key: string, fallback: boolean): boolean {
  const val = storage.getString(key);
  if (val === undefined) return fallback;
  return val === 'true';
}

export interface NotificationPrefs {
  masterEnabled: boolean;
  comments: boolean;
  assigned: boolean;
  reminders: boolean;
}

export interface UseNotificationPrefsResult {
  prefs: NotificationPrefs;
  setMasterEnabled: (v: boolean) => void;
  setComments: (v: boolean) => void;
  setAssigned: (v: boolean) => void;
  setReminders: (v: boolean) => void;
}

export function useNotificationPrefs(): UseNotificationPrefsResult {
  const [masterEnabled, setMasterState] = useState(() => getBool(KEYS.MASTER, true));
  const [comments, setCommentsState] = useState(() => getBool(KEYS.COMMENTS, true));
  const [assigned, setAssignedState] = useState(() => getBool(KEYS.ASSIGNED, true));
  const [reminders, setRemindersState] = useState(() => getBool(KEYS.REMINDERS, true));

  const setMasterEnabled = useCallback((v: boolean) => {
    storage.set(KEYS.MASTER, String(v));
    setMasterState(v);
  }, []);
  const setComments = useCallback((v: boolean) => {
    storage.set(KEYS.COMMENTS, String(v));
    setCommentsState(v);
  }, []);
  const setAssigned = useCallback((v: boolean) => {
    storage.set(KEYS.ASSIGNED, String(v));
    setAssignedState(v);
  }, []);
  const setReminders = useCallback((v: boolean) => {
    storage.set(KEYS.REMINDERS, String(v));
    setRemindersState(v);
  }, []);

  return {
    prefs: { masterEnabled, comments, assigned, reminders },
    setMasterEnabled,
    setComments,
    setAssigned,
    setReminders,
  };
}
