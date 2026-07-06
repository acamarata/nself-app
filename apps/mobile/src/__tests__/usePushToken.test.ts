/**
 * Purpose: Tests for usePushToken Expo push token registration.
 * SPORT: C-S6-T2
 */
import { renderHook } from '@testing-library/react-native';

// Factories must be self-contained — jest.mock is hoisted and outer const/let
// are not yet initialized when the factory runs.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
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

const mockRegisterDeviceToken = jest.fn().mockResolvedValue({});
jest.mock('urql', () => ({
  useMutation: jest.fn(() => [{ fetching: false }, mockRegisterDeviceToken]),
}));

jest.mock('../lib/deviceTokenOps', () => ({
  REGISTER_DEVICE_TOKEN: 'REGISTER_DEVICE_TOKEN',
}));

import { usePushToken } from '../hooks/usePushToken';
const Notif = require('expo-notifications');

// A minimal unsigned JWT with payload { sub: 'user-123' } — base64url of
// '{"sub":"user-123"}' in the middle segment. Header/signature are irrelevant
// to decodeUserIdFromJwt, which only parses the middle segment.
const JWT_WITH_SUB = `header.${btoa('{"sub":"user-123"}')}.sig`;
const JWT_MALFORMED = 'not-a-jwt';

describe('usePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notif.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notif.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    Notif.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
    mockRegisterDeviceToken.mockResolvedValue({});
  });

  it('registers push token via RegisterDeviceToken mutation when accessToken has a valid sub claim', async () => {
    renderHook(() => usePushToken({ accessToken: JWT_WITH_SUB }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'ntask-test-project' });
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ExponentPushToken[test]', platform: expect.any(String) }),
    );
  });

  it('requests permission when not already granted', async () => {
    Notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    renderHook(() => usePushToken({ accessToken: JWT_WITH_SUB }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockRegisterDeviceToken).toHaveBeenCalled();
  });

  it('skips registration when permission is denied after requesting', async () => {
    Notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notif.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    renderHook(() => usePushToken({ accessToken: JWT_WITH_SUB }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });

  it('skips registration when accessToken is null', async () => {
    renderHook(() => usePushToken({ accessToken: null }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });

  it('skips registration when accessToken cannot be decoded into a userId', async () => {
    renderHook(() => usePushToken({ accessToken: JWT_MALFORMED }));
    await new Promise((r) => setTimeout(r, 100));
    expect(Notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });
});
