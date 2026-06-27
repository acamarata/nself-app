/**
 * Purpose: Local notification scheduling for task due-date reminders.
 * Schedules local push notifications via expo-notifications.
 * Persists notification IDs to MMKV keyed by taskId.
 * Constraints: Fully local — no backend dependency. ≤100L.
 * SPORT: C-S6-T1
 */
import { useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'ntask-reminders' });

export interface ReminderOffset {
  label: string;
  offsetMs: number;
}

export const REMINDER_OFFSETS: ReminderOffset[] = [
  { label: '30 minutes before', offsetMs: 30 * 60 * 1000 },
  { label: '1 hour before', offsetMs: 60 * 60 * 1000 },
  { label: '1 day before', offsetMs: 24 * 60 * 60 * 1000 },
  { label: '3 days before', offsetMs: 3 * 24 * 60 * 60 * 1000 },
];

export interface UseRemindersResult {
  requestPermissions: () => Promise<boolean>;
  scheduleReminder: (taskId: string, taskTitle: string, dueDate: Date, offsetMs: number) => Promise<void>;
  cancelReminder: (taskId: string) => Promise<void>;
  getNotificationId: (taskId: string) => string | undefined;
}

export function useReminders(): UseRemindersResult {
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === 'granted';
  }, []);

  const scheduleReminder = useCallback(async (
    taskId: string, taskTitle: string, dueDate: Date, offsetMs: number,
  ): Promise<void> => {
    const existing = storage.getString(`reminder:${taskId}`);
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing);

    const fireDate = new Date(dueDate.getTime() - offsetMs);
    if (fireDate <= new Date()) return; // past — skip

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Task due soon',
        body: taskTitle,
        data: { taskId, url: `ntask://task/${taskId}` },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    storage.set(`reminder:${taskId}`, id);
  }, []);

  const cancelReminder = useCallback(async (taskId: string): Promise<void> => {
    const id = storage.getString(`reminder:${taskId}`);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      storage.delete(`reminder:${taskId}`);
    }
  }, []);

  const getNotificationId = useCallback((taskId: string): string | undefined => {
    return storage.getString(`reminder:${taskId}`);
  }, []);

  return { requestPermissions, scheduleReminder, cancelReminder, getNotificationId };
}
