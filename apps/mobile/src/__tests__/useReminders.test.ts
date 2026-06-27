/**
 * Purpose: Tests for useReminders local notification scheduling.
 * SPORT: C-S6-T1
 */
import { renderHook, act } from '@testing-library/react-native';

// Factories must be self-contained — jest.mock is hoisted and outer const/let
// are not yet initialized when the factory runs.
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id-123'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { useReminders } from '../hooks/useReminders';
const { MMKV } = require('react-native-mmkv');
const Notif = require('expo-notifications');

describe('useReminders', () => {
  beforeEach(() => {
    // Clear the ntask-reminders store between tests using the shared in-memory mock
    const store = new MMKV({ id: 'ntask-reminders' });
    store.clearAll();
    jest.clearAllMocks();
    // Restore mocks after clearAllMocks
    Notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notif.scheduleNotificationAsync.mockResolvedValue('notif-id-123');
    Notif.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    Notif.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
  });

  it('requestPermissions returns true when granted', async () => {
    const { result } = renderHook(() => useReminders());
    let granted = false;
    await act(async () => { granted = await result.current.requestPermissions(); });
    expect(granted).toBe(true);
  });

  it('scheduleReminder calls scheduleNotificationAsync for future date', async () => {
    const { result } = renderHook(() => useReminders());
    const futureDate = new Date(Date.now() + 60 * 60 * 1000 * 2); // 2h from now
    await act(async () => {
      await result.current.scheduleReminder('task-1', 'Buy milk', futureDate, 30 * 60 * 1000);
    });
    expect(Notif.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('cancelReminder calls cancelScheduledNotificationAsync when id stored', async () => {
    // Pre-seed the store with a notification id using the shared in-memory MMKV mock
    const store = new MMKV({ id: 'ntask-reminders' });
    store.set('reminder:task-2', 'existing-notif-id');

    const { result } = renderHook(() => useReminders());
    await act(async () => { await result.current.cancelReminder('task-2'); });
    expect(Notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('existing-notif-id');
  });
});
