/**
 * Purpose: List presence heartbeat ops — upsert and remove viewer/editor presence.
 * Inputs:  listId, status ('viewing' | 'editing').
 * Outputs: Success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import { UPSERT_PRESENCE, REMOVE_PRESENCE } from '@nself/ntask-core';

export async function upsertPresence(listId: string, status: 'viewing' | 'editing'): Promise<boolean> {
  const res = await gql<{ insert_np_list_presence_one: { id: string } }>(UPSERT_PRESENCE, {
    listId,
    status,
    editingTodoId: null,
  });
  return !res.error && !!res.data?.insert_np_list_presence_one;
}

export async function removePresence(listId: string): Promise<boolean> {
  const res = await gql<{ delete_np_list_presence: { affected_rows: number } }>(
    REMOVE_PRESENCE,
    { listId },
  );
  return !res.error && (res.data?.delete_np_list_presence.affected_rows ?? 0) >= 0;
}
