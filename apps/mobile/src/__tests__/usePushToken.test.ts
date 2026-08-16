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

// A syntactically-valid EAS project UUID (v4 shape) — the real value only
// exists after `eas init` has run; see RELEASING.md.
const VALID_PROJECT_ID = 'a1b2c3d4-e5f6-47a8-89ab-cdef01234567';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.1.4',
      extra: { eas: { projectId: 'a1b2c3d4-e5f6-47a8-89ab-cdef01234567' } },
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

const mockLoggerError = jest.fn();
jest.mock('@nself/observability', () => ({
  // createLogger runs at usePushToken.ts's module top level, which (per jest's
  // import hoisting) can execute before `const mockLoggerError = jest.fn()`
  // below is assigned. Wrapping in an arrow defers the `mockLoggerError` read
  // to call-time instead of factory-creation-time, sidestepping that TDZ/hoist
  // ordering trap (see file header comment).
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    child: jest.fn(),
  })),
}));

import { usePushToken, isValidEasProjectId } from '../hooks/usePushToken';
const Notif = require('expo-notifications');
const ExpoConstants = require('expo-constants').default;

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
    expect(Notif.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: VALID_PROJECT_ID });
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

  describe('isValidEasProjectId', () => {
    it('accepts a UUID-shaped projectId', () => {
      expect(isValidEasProjectId('a1b2c3d4-e5f6-47a8-89ab-cdef01234567')).toBe(true);
    });

    it('rejects the checked-in placeholder "ntask-mobile"', () => {
      expect(isValidEasProjectId('ntask-mobile')).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidEasProjectId(undefined)).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isValidEasProjectId('')).toBe(false);
    });
  });

  describe('invalid projectId shape (e.g. checked-in placeholder)', () => {
    beforeEach(() => {
      ExpoConstants.expoConfig.extra.eas.projectId = 'ntask-mobile';
    });

    afterEach(() => {
      ExpoConstants.expoConfig.extra.eas.projectId = VALID_PROJECT_ID;
    });

    it('does not call getExpoPushTokenAsync or register a device token', async () => {
      renderHook(() => usePushToken({ accessToken: JWT_WITH_SUB }));
      await new Promise((r) => setTimeout(r, 100));
      expect(Notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
    });

    it('logs a loud error via the shared logger', async () => {
      renderHook(() => usePushToken({ accessToken: JWT_WITH_SUB }));
      await new Promise((r) => setTimeout(r, 100));
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('invalid EAS projectId'),
        expect.objectContaining({ projectId: 'ntask-mobile' }),
      );
    });
  });
});
