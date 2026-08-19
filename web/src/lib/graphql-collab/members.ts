/**
 * Purpose: List membership ops — members, roles, leave, ownership transfer.
 * Inputs:  listId, userId, role strings.
 * Outputs: Typed NpListMember rows and success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import { GET_LIST_MEMBERS, UPDATE_MEMBER_ROLE, REMOVE_MEMBER } from '@nself/ntask-core';
import type { NpListMember } from '@nself/ntask-core';

export async function getListMembers(listId: string): Promise<NpListMember[]> {
  const res = await gql<{ np_list_members: NpListMember[] }>(GET_LIST_MEMBERS, { listId });
  if (res.error || !res.data) return [];
  return res.data.np_list_members;
}

export async function removeMember(listId: string, userId: string): Promise<boolean> {
  const res = await gql<{ delete_np_list_members: { affected_rows: number } }>(REMOVE_MEMBER, {
    listId,
    userId,
  });
  return !res.error && (res.data?.delete_np_list_members.affected_rows ?? 0) > 0;
}

export async function updateMemberRole(
  listId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  const res = await gql<{ update_np_list_members: { affected_rows: number } }>(
    UPDATE_MEMBER_ROLE,
    { listId, userId, role },
  );
  return !res.error && (res.data?.update_np_list_members.affected_rows ?? 0) > 0;
}

/** Self-leave: delegates to removeMember for clarity at call sites. */
export async function leaveList(listId: string, userId: string): Promise<boolean> {
  return removeMember(listId, userId);
}

// ── Inline GQL (ops not yet in @nself/ntask-core) ──────────────────────────

const TRANSFER_OWNERSHIP = /* GraphQL */`
  mutation TransferOwnership(
    $listId: uuid!
    $newOwnerId: uuid!
    $currentOwnerId: uuid!
  ) {
    update_np_lists_by_pk(
      pk_columns: { id: $listId }
      _set: { user_id: $newOwnerId }
    ) {
      id
    }
    demote_old_owner: update_np_list_members(
      where: { list_id: { _eq: $listId }, user_id: { _eq: $currentOwnerId } }
      _set: { role: "editor" }
    ) {
      affected_rows
    }
    promote_new_owner: update_np_list_members(
      where: { list_id: { _eq: $listId }, user_id: { _eq: $newOwnerId } }
      _set: { role: "owner" }
    ) {
      affected_rows
    }
  }
`;

export async function transferOwnership(
  listId: string,
  newOwnerId: string,
  currentOwnerId: string,
): Promise<boolean> {
  const res = await gql<{
    update_np_lists_by_pk: { id: string } | null;
  }>(TRANSFER_OWNERSHIP, { listId, newOwnerId, currentOwnerId });
  return !res.error && !!res.data?.update_np_lists_by_pk;
}
