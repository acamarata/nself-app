/**
 * Purpose: Unit tests for useCollab hooks — urql is mocked; we test hook contracts, not network.
 * Constraints: Free plugins only. urql mocked at module level.
 * SPORT: P5-L-collab-ops
 */
import { renderHook } from '@testing-library/react-native';

jest.mock('urql', () => ({
  useMutation: () => [{ fetching: false }, jest.fn()],
  useQuery: () => [{ data: null, fetching: false, error: undefined }, jest.fn()],
  useSubscription: () => [{ data: null, fetching: false }],
}));

// collabOps exports GraphQL documents and types — mock so Jest doesn't try to parse gql tags
jest.mock('../../lib/collabOps', () => ({
  GET_LIST_MEMBERS: 'GET_LIST_MEMBERS',
  GET_LIST_INVITES: 'GET_LIST_INVITES',
  SUBSCRIBE_LIST_PRESENCE: 'SUBSCRIBE_LIST_PRESENCE',
  CREATE_SHARE_LINK: 'CREATE_SHARE_LINK',
  REVOKE_SHARE_LINK: 'REVOKE_SHARE_LINK',
  CREATE_LIST_INVITE: 'CREATE_LIST_INVITE',
  ACCEPT_LIST_INVITE: 'ACCEPT_LIST_INVITE',
  DECLINE_LIST_INVITE: 'DECLINE_LIST_INVITE',
  REVOKE_LIST_INVITE: 'REVOKE_LIST_INVITE',
  UPDATE_MEMBER_ROLE: 'UPDATE_MEMBER_ROLE',
  REMOVE_MEMBER: 'REMOVE_MEMBER',
  LEAVE_LIST: 'LEAVE_LIST',
  TRANSFER_OWNERSHIP: 'TRANSFER_OWNERSHIP',
  UPSERT_PRESENCE: 'UPSERT_PRESENCE',
  REMOVE_PRESENCE: 'REMOVE_PRESENCE',
}));

import { useListMembers, useListPresence, useCollabMutations } from '../useCollab';

describe('useListMembers', () => {
  it('returns members=[] and fetching=false when query data is null', () => {
    const { result } = renderHook(() => useListMembers('list-1'));
    expect(result.current.members).toEqual([]);
    expect(result.current.fetching).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('exposes a refetch function', () => {
    const { result } = renderHook(() => useListMembers('list-1'));
    expect(typeof result.current.refetch).toBe('function');
  });
});

describe('useListPresence', () => {
  it('returns presenceUsers=[] when subscription data is null', () => {
    const { result } = renderHook(() => useListPresence('list-1'));
    expect(result.current.presenceUsers).toEqual([]);
  });
});

describe('useCollabMutations', () => {
  const EXPECTED_FUNCTIONS = [
    'createShareLink',
    'revokeShareLink',
    'createInvite',
    'acceptInvite',
    'declineInvite',
    'revokeInvite',
    'updateRole',
    'removeMember',
    'leaveList',
    'transferOwnership',
    'upsertPresence',
    'removePresence',
  ] as const;

  it('returns all expected executor function names', () => {
    const { result } = renderHook(() => useCollabMutations());
    EXPECTED_FUNCTIONS.forEach((name) => {
      expect(typeof result.current[name]).toBe('function');
    });
  });

  it('does not expose unexpected keys', () => {
    const { result } = renderHook(() => useCollabMutations());
    const returnedKeys = Object.keys(result.current).sort();
    const expectedKeys = [...EXPECTED_FUNCTIONS].sort();
    expect(returnedKeys).toEqual(expectedKeys);
  });
});
