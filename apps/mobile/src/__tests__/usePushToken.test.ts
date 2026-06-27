/**
 * Purpose: Tests for usePushToken Expo push token registration.
 * SPORT: C-S6-T2
 */
import { renderHook } from '@testing-library/react-native';

// Factories must be self-contained — jest.mock is hoisted and outer const/let
// are not yet initialized when the factory runs.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.1.4',
      extra: { eas: { projectId: 'ntask-test-project' } },
    },
  },
}));

global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;

import { usePushToken } from '../hooks/usePushToken';
const Notif = require('expo-notifications');

describe('usePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notif.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notif.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    Notif.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('registers push token when userId, serverUrl, accessToken provided', async () => {
    renderHook(() => usePushToken({
      userId: 'user-123',
      serverUrl: 'https://example.com',
      accessToken: 'test-token',
    }));
    // Wait for async effect
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'ntask-test-project' });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/v1/push/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('skips registration when no userId', async () => {
    renderHook(() => usePushToken({ userId: null, serverUrl: 'https://example.com', accessToken: 'token' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});
