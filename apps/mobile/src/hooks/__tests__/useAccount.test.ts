/**
 * Purpose: Unit tests for useAccount hooks — urql mocked; tests contract shape, not network.
 * Constraints: Free plugins only. urql mocked at module level.
 * SPORT: P5-J-account-ops
 */
import { renderHook } from '@testing-library/react-native';

jest.mock('urql', () => ({
  useMutation: () => [{ fetching: false }, jest.fn()],
  useQuery: () => [{ data: null, fetching: false, error: undefined }, jest.fn()],
}));

jest.mock('../../lib/accountOps', () => ({
  DELETE_MY_ACCOUNT: 'DELETE_MY_ACCOUNT',
  REQUEST_DATA_EXPORT: 'REQUEST_DATA_EXPORT',
  CHANGE_EMAIL: 'CHANGE_EMAIL',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  ENABLE_MFA: 'ENABLE_MFA',
  DISABLE_MFA: 'DISABLE_MFA',
  LIST_SESSIONS: 'LIST_SESSIONS',
  REVOKE_SESSION: 'REVOKE_SESSION',
}));

import { useAccountMutations, useSessions } from '../useAccount';

describe('useAccountMutations', () => {
  const EXPECTED_FUNCTIONS = [
    'deleteAccount',
    'requestDataExport',
    'changeEmail',
    'changePassword',
    'enableMfa',
    'disableMfa',
    'revokeSession',
  ] as const;

  it('returns all expected mutation function names', () => {
    const { result } = renderHook(() => useAccountMutations());
    EXPECTED_FUNCTIONS.forEach((name) => {
      expect(typeof result.current[name]).toBe('function');
    });
  });

  it('does not expose unexpected keys', () => {
    const { result } = renderHook(() => useAccountMutations());
    const returnedKeys = Object.keys(result.current).sort();
    const expectedKeys = [...EXPECTED_FUNCTIONS].sort();
    expect(returnedKeys).toEqual(expectedKeys);
  });
});

describe('useSessions', () => {
  it('returns sessions=[], fetching=false, error=undefined when query data is null', () => {
    const { result } = renderHook(() => useSessions());
    expect(result.current.sessions).toEqual([]);
    expect(result.current.fetching).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('exposes a refetch function', () => {
    const { result } = renderHook(() => useSessions());
    expect(typeof result.current.refetch).toBe('function');
  });
});
