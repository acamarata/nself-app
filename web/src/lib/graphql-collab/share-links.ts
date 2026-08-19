/**
 * Purpose: Token-based share links — create/revoke links, read + update shared lists.
 * Inputs:  listId, shareId, token, permission strings, optional expiry days.
 * Outputs: ShareLinkResult / SharedListResult objects and success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import type { NpList, NpTaskSummary } from '@nself/ntask-core';

export interface ShareLinkResult { id: string; token: string; shareUrl: string; }
export interface SharedListResult { list: NpList & { permission: 'view' | 'edit' }; todos: NpTaskSummary[]; }

// ── Inline GQL (ops not yet in @nself/ntask-core) ──────────────────────────

const CREATE_SHARE_LINK = /* GraphQL */`
  mutation CreateShareLink(
    $listId: uuid!
    $permission: String!
    $expiresAt: timestamptz
  ) {
    insert_np_list_shares_one(object: {
      list_id: $listId
      permission: $permission
      shared_with_email: ""
      expires_at: $expiresAt
    }) {
      id
      token
    }
  }
`;

const REVOKE_SHARE_LINK = /* GraphQL */`
  mutation RevokeShareLink($shareId: uuid!) {
    delete_np_list_shares_by_pk(id: $shareId) {
      id
    }
  }
`;

const GET_SHARED_LIST = /* GraphQL */`
  query GetSharedList($token: uuid!) {
    np_list_shares(where: { token: { _eq: $token }, accepted_at: { _is_null: true } } limit: 1) {
      permission
      list {
        id user_id title description color icon is_default position
        group_id source_account_id created_at updated_at
        np_todos(where: { completed: { _eq: false } } order_by: { position: asc }) {
          id list_id title completed priority due_date position
          source_account_id created_at updated_at
        }
      }
    }
  }
`;

const UPDATE_SHARED_TODO = /* GraphQL */`
  mutation UpdateSharedTodo($id: uuid!, $completed: Boolean!) {
    update_np_todos_by_pk(
      pk_columns: { id: $id }
      _set: { completed: $completed }
    ) {
      id completed
    }
  }
`;

export async function createShareLink(
  listId: string,
  permission: string,
  expiresInDays?: number,
): Promise<ShareLinkResult | null> {
  const expiresAt = expiresInDays != null
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const res = await gql<{ insert_np_list_shares_one: { id: string; token: string } }>(
    CREATE_SHARE_LINK,
    { listId, permission, expiresAt },
  );
  if (res.error || !res.data) return null;

  const { id, token } = res.data.insert_np_list_shares_one;
  return { id, token, shareUrl: `https://task.nself.org/shared/${token}` };
}

export async function revokeShareLink(shareId: string): Promise<boolean> {
  const res = await gql<{ delete_np_list_shares_by_pk: { id: string } | null }>(
    REVOKE_SHARE_LINK,
    { shareId },
  );
  return !res.error && !!res.data?.delete_np_list_shares_by_pk;
}

export async function getSharedList(token: string): Promise<SharedListResult | null> {
  const res = await gql<{
    np_list_shares: Array<{
      permission: string;
      list: NpList & { np_todos: NpTaskSummary[] };
    }>;
  }>(GET_SHARED_LIST, { token });

  if (res.error || !res.data) return null;
  const row = res.data.np_list_shares[0];
  if (!row?.list) return null;

  const { np_todos, ...listBase } = row.list;
  const permission: 'view' | 'edit' = row.permission === 'edit' ? 'edit' : 'view';
  return { list: { ...listBase, permission }, todos: np_todos };
}

export async function updateSharedTodo(id: string, completed: boolean): Promise<boolean> {
  const res = await gql<{ update_np_todos_by_pk: { id: string; completed: boolean } | null }>(
    UPDATE_SHARED_TODO,
    { id, completed },
  );
  return !res.error && !!res.data?.update_np_todos_by_pk;
}
