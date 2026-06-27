/**
 * Purpose: React hooks for Epic L collaboration — list members, invites, presence,
 *          share links, and role/ownership management via urql.
 * Inputs:  listId (string uuid) for query/subscription hooks; mutation args per operation.
 * Outputs: Typed query state objects and mutation executor functions.
 * Constraints:
 *   - urql only (no Apollo); subscriptions require a WS exchange on the urql client
 *   - All operations route through Hasura actions (not direct table mutations)
 *   - Free plugins only; no pro plugin deps
 * SPORT: P5-L-collab-ops
 */

import { useMutation, useQuery, useSubscription } from 'urql';
import {
  GET_LIST_MEMBERS,
  GET_LIST_INVITES,
  SUBSCRIBE_LIST_PRESENCE,
  CREATE_SHARE_LINK,
  REVOKE_SHARE_LINK,
  CREATE_LIST_INVITE,
  ACCEPT_LIST_INVITE,
  DECLINE_LIST_INVITE,
  REVOKE_LIST_INVITE,
  UPDATE_MEMBER_ROLE,
  REMOVE_MEMBER,
  LEAVE_LIST,
  TRANSFER_OWNERSHIP,
  UPSERT_PRESENCE,
  REMOVE_PRESENCE,
  type ListMember,
  type ListInvite,
  type PresenceUser,
} from '../lib/collabOps';

// ---------------------------------------------------------------------------
// Query shapes
// ---------------------------------------------------------------------------

interface GetListMembersData {
  np_list_members: ListMember[];
}

interface GetListInvitesData {
  np_list_invites: ListInvite[];
}

interface SubscribeListPresenceData {
  np_list_presence: PresenceUser[];
}

// ---------------------------------------------------------------------------
// useListMembers
// ---------------------------------------------------------------------------

/**
 * Purpose: Fetch all members of a shared list with their profile data.
 * Inputs:  listId — uuid of the target np_list row.
 * Outputs: { members, fetching, error, refetch }
 * Constraints: Paused when listId is empty.
 * SPORT: P5-L-collab-ops
 */
export function useListMembers(listId: string) {
  const [result, refetch] = useQuery<GetListMembersData>({
    query: GET_LIST_MEMBERS,
    variables: { listId },
    pause: !listId,
  });

  return {
    members: result.data?.np_list_members ?? [],
    fetching: result.fetching,
    error: result.error,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// useListInvites
// ---------------------------------------------------------------------------

/**
 * Purpose: Fetch all pending/sent invites for a shared list.
 * Inputs:  listId — uuid of the target np_list row.
 * Outputs: { invites, fetching, error, refetch }
 * Constraints: Paused when listId is empty.
 * SPORT: P5-L-collab-ops
 */
export function useListInvites(listId: string) {
  const [result, refetch] = useQuery<GetListInvitesData>({
    query: GET_LIST_INVITES,
    variables: { listId },
    pause: !listId,
  });

  return {
    invites: result.data?.np_list_invites ?? [],
    fetching: result.fetching,
    error: result.error,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// useListPresence
// ---------------------------------------------------------------------------

/**
 * Purpose: Live subscription to the presence state of all active members on a list.
 * Inputs:  listId — uuid of the target np_list row.
 * Outputs: { presenceUsers } — array updates on every server push.
 * Constraints:
 *   - Requires WebSocket exchange configured on the urql client.
 *   - Paused when listId is empty.
 * SPORT: P5-L-collab-ops
 */
export function useListPresence(listId: string) {
  const [result] = useSubscription<SubscribeListPresenceData>({
    query: SUBSCRIBE_LIST_PRESENCE,
    variables: { listId },
    pause: !listId,
  });

  return {
    presenceUsers: result.data?.np_list_presence ?? [],
  };
}

// ---------------------------------------------------------------------------
// useCollabMutations
// ---------------------------------------------------------------------------

/**
 * Purpose: Exposes all collaboration mutation executors in one hook.
 * Inputs:  n/a — variables passed at call time per executor.
 * Outputs: Named executor functions matching Hasura action signatures.
 * Constraints:
 *   - Each executor returns a urql OperationResult promise.
 *   - Callers must check .error on the result for Hasura action errors.
 * SPORT: P5-L-collab-ops
 */
export function useCollabMutations() {
  const [, execCreateShareLink] = useMutation(CREATE_SHARE_LINK);
  const [, execRevokeShareLink] = useMutation(REVOKE_SHARE_LINK);
  const [, execCreateInvite] = useMutation(CREATE_LIST_INVITE);
  const [, execAcceptInvite] = useMutation(ACCEPT_LIST_INVITE);
  const [, execDeclineInvite] = useMutation(DECLINE_LIST_INVITE);
  const [, execRevokeInvite] = useMutation(REVOKE_LIST_INVITE);
  const [, execUpdateRole] = useMutation(UPDATE_MEMBER_ROLE);
  const [, execRemoveMember] = useMutation(REMOVE_MEMBER);
  const [, execLeaveList] = useMutation(LEAVE_LIST);
  const [, execTransferOwnership] = useMutation(TRANSFER_OWNERSHIP);
  const [, execUpsertPresence] = useMutation(UPSERT_PRESENCE);
  const [, execRemovePresence] = useMutation(REMOVE_PRESENCE);

  return {
    createShareLink: (listId: string) =>
      execCreateShareLink({ listId }),

    revokeShareLink: (listId: string, shareId: string) =>
      execRevokeShareLink({ listId, shareId }),

    createInvite: (listId: string, email: string, role: string) =>
      execCreateInvite({ listId, email, role }),

    acceptInvite: (inviteId: string) =>
      execAcceptInvite({ inviteId }),

    declineInvite: (inviteId: string) =>
      execDeclineInvite({ inviteId }),

    revokeInvite: (inviteId: string) =>
      execRevokeInvite({ inviteId }),

    updateRole: (listId: string, userId: string, role: string) =>
      execUpdateRole({ listId, userId, role }),

    removeMember: (listId: string, userId: string) =>
      execRemoveMember({ listId, userId }),

    leaveList: (listId: string) =>
      execLeaveList({ listId }),

    transferOwnership: (listId: string, newOwnerId: string) =>
      execTransferOwnership({ listId, newOwnerId }),

    upsertPresence: (listId: string, status: string, editingTodoId?: string) =>
      execUpsertPresence({ listId, status, editingTodoId: editingTodoId ?? null }),

    removePresence: (listId: string) =>
      execRemovePresence({ listId }),
  };
}
