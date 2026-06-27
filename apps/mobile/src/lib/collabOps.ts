/**
 * Purpose: GraphQL operations for Epic L collaboration — members, invites, presence,
 *          share links, and role management. All targets are Hasura actions or np_* tables.
 *          These ops are not yet in @nself/ntask-core so are defined inline here.
 * Inputs:  n/a (document node exports consumed by urql hooks)
 * Outputs: TypedDocumentNode-compatible gql tag objects
 * Constraints:
 *   - np_* table naming (post-Epic-A schema)
 *   - Hasura action mutations use camelCase action names, not table insert paths
 *   - Free plugins only (no pro plugin deps)
 * SPORT: P5-L-collab-ops
 */

import { gql } from 'urql';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberProfile {
  display_name: string | null;
  avatar_url: string | null;
}

export interface ListMember {
  id: string;
  list_id: string;
  user_id: string;
  role: string;
  added_at: string;
  profile: MemberProfile | null;
}

export interface ListInvite {
  id: string;
  list_id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  invited_by: string;
}

export interface PresenceUser {
  id: string;
  list_id: string;
  user_id: string;
  status: string;
  editing_todo_id: string | null;
  last_seen_at: string;
  profile: MemberProfile | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const GET_LIST_MEMBERS = gql`
  query GetListMembers($listId: uuid!) {
    np_list_members(where: { list_id: { _eq: $listId } }) {
      id
      list_id
      user_id
      role
      added_at
      profile {
        display_name
        avatar_url
      }
    }
  }
`;

export const GET_LIST_INVITES = gql`
  query GetListInvites($listId: uuid!) {
    np_list_invites(where: { list_id: { _eq: $listId } }) {
      id
      list_id
      email
      role
      status
      invited_at
      invited_by
    }
  }
`;

export const GET_LIST_PRESENCE = gql`
  query GetListPresence($listId: uuid!) {
    np_list_presence(where: { list_id: { _eq: $listId } }) {
      id
      list_id
      user_id
      status
      editing_todo_id
      last_seen_at
      profile {
        display_name
        avatar_url
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export const SUBSCRIBE_LIST_PRESENCE = gql`
  subscription SubscribeListPresence($listId: uuid!) {
    np_list_presence(where: { list_id: { _eq: $listId } }) {
      id
      list_id
      user_id
      status
      editing_todo_id
      last_seen_at
      profile {
        display_name
        avatar_url
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Share-link mutations (Hasura actions)
// ---------------------------------------------------------------------------

export const CREATE_SHARE_LINK = gql`
  mutation CreateShareLink($listId: uuid!) {
    createShareLink(listId: $listId) {
      id
      list_id
      share_token
      created_at
      expires_at
    }
  }
`;

export const REVOKE_SHARE_LINK = gql`
  mutation RevokeShareLink($listId: uuid!, $shareId: uuid!) {
    revokeShareLink(listId: $listId, shareId: $shareId) {
      id
      list_id
    }
  }
`;

// ---------------------------------------------------------------------------
// Invite mutations (Hasura actions)
// ---------------------------------------------------------------------------

export const CREATE_LIST_INVITE = gql`
  mutation CreateListInvite($listId: uuid!, $email: String!, $role: String!) {
    createListInvite(listId: $listId, email: $email, role: $role) {
      id
      list_id
      email
      role
      status
    }
  }
`;

export const ACCEPT_LIST_INVITE = gql`
  mutation AcceptListInvite($inviteId: uuid!) {
    acceptListInvite(inviteId: $inviteId) {
      id
      list_id
      email
      role
      status
    }
  }
`;

export const DECLINE_LIST_INVITE = gql`
  mutation DeclineListInvite($inviteId: uuid!) {
    declineListInvite(inviteId: $inviteId) {
      id
      list_id
      email
      role
      status
    }
  }
`;

export const REVOKE_LIST_INVITE = gql`
  mutation RevokeListInvite($inviteId: uuid!) {
    revokeListInvite(inviteId: $inviteId) {
      id
      list_id
      email
      role
      status
    }
  }
`;

// ---------------------------------------------------------------------------
// Member management mutations (Hasura actions)
// ---------------------------------------------------------------------------

export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($listId: uuid!, $userId: uuid!, $role: String!) {
    updateMemberRole(listId: $listId, userId: $userId, role: $role) {
      id
      list_id
      user_id
      role
    }
  }
`;

export const REMOVE_MEMBER = gql`
  mutation RemoveMember($listId: uuid!, $userId: uuid!) {
    removeMember(listId: $listId, userId: $userId) {
      id
      list_id
      user_id
    }
  }
`;

export const LEAVE_LIST = gql`
  mutation LeaveList($listId: uuid!) {
    leaveList(listId: $listId) {
      list_id
    }
  }
`;

export const TRANSFER_OWNERSHIP = gql`
  mutation TransferOwnership($listId: uuid!, $newOwnerId: uuid!) {
    transferOwnership(listId: $listId, newOwnerId: $newOwnerId) {
      id
      list_id
      user_id
      role
    }
  }
`;

// ---------------------------------------------------------------------------
// Presence mutations (Hasura actions)
// ---------------------------------------------------------------------------

export const UPSERT_PRESENCE = gql`
  mutation UpsertPresence($listId: uuid!, $status: String!, $editingTodoId: uuid) {
    upsertPresence(listId: $listId, status: $status, editingTodoId: $editingTodoId) {
      id
      list_id
      user_id
      status
      editing_todo_id
      last_seen_at
    }
  }
`;

export const REMOVE_PRESENCE = gql`
  mutation RemovePresence($listId: uuid!) {
    removePresence(listId: $listId) {
      list_id
    }
  }
`;
