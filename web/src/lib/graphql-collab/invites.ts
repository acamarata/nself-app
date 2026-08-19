/**
 * Purpose: Email-based list invites — create, accept, decline, list shares/pending.
 * Inputs:  listId, shareId, email, permission strings.
 * Outputs: Typed NpListShare rows and success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import { GET_LIST_SHARES, CREATE_LIST_SHARE } from '@nself/ntask-core';
import type { NpListShare } from '@nself/ntask-core';

export async function getListShares(listId: string): Promise<NpListShare[]> {
  const res = await gql<{ np_list_shares: NpListShare[] }>(GET_LIST_SHARES, { listId });
  if (res.error || !res.data) return [];
  return res.data.np_list_shares;
}

export async function createListInvite(
  listId: string,
  email: string,
  permission: string,
): Promise<NpListShare | null> {
  const res = await gql<{ insert_np_list_shares_one: NpListShare }>(CREATE_LIST_SHARE, {
    listId,
    sharedWithEmail: email,
    permission,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_list_shares_one;
}

// ── Inline GQL (ops not yet in @nself/ntask-core) ──────────────────────────

const ACCEPT_LIST_INVITE = /* GraphQL */`
  mutation AcceptListInvite($shareId: uuid!) {
    update_np_list_shares_by_pk(
      pk_columns: { id: $shareId }
      _set: { accepted_at: "now()" }
    ) {
      id
    }
  }
`;

const DECLINE_LIST_INVITE = /* GraphQL */`
  mutation DeclineListInvite($shareId: uuid!) {
    delete_np_list_shares_by_pk(id: $shareId) {
      id
    }
  }
`;

export async function acceptListInvite(shareId: string): Promise<boolean> {
  const res = await gql<{ update_np_list_shares_by_pk: { id: string } | null }>(
    ACCEPT_LIST_INVITE,
    { shareId },
  );
  return !res.error && !!res.data?.update_np_list_shares_by_pk;
}

export async function declineListInvite(shareId: string): Promise<boolean> {
  const res = await gql<{ delete_np_list_shares_by_pk: { id: string } | null }>(
    DECLINE_LIST_INVITE,
    { shareId },
  );
  return !res.error && !!res.data?.delete_np_list_shares_by_pk;
}

// ── User-scoped invite queries ──────────────────────────────────────────────

const GET_PENDING_INVITES = /* GraphQL */`
  query GetPendingInvites($email: String!) {
    np_list_shares(where: {
      shared_with_email: { _eq: $email }
      accepted_at: { _is_null: true }
    }) {
      id
      list_id
      shared_with_email
      permission
      invited_by
      source_account_id
      created_at
      updated_at
    }
  }
`;

export async function getPendingInvites(email: string): Promise<NpListShare[]> {
  const res = await gql<{ np_list_shares: NpListShare[] }>(GET_PENDING_INVITES, { email });
  if (res.error || !res.data) return [];
  return res.data.np_list_shares;
}
