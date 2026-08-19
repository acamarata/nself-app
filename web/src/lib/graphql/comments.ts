/**
 * Purpose: Typed comment CRUD over @nself/ntask-core GraphQL operations.
 * Inputs: Comment operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpComment domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_COMMENTS,
  CREATE_COMMENT,
  UPDATE_COMMENT,
  DELETE_COMMENT,
} from '@nself/ntask-core';
import type { NpComment, CreateCommentInput, UpdateCommentInput } from '@nself/ntask-core';

export async function getComments(todoId: string): Promise<NpComment[]> {
  const res = await gql<{ np_comments: NpComment[] }>(GET_COMMENTS, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_comments;
}

export async function createComment(input: CreateCommentInput): Promise<NpComment | null> {
  // CREATE_COMMENT declares flat variables ($todoId, $body, $parentCommentId,
  // $idempotencyKey), not a single $input object (see
  // packages/@nself/ntask-core/src/operations/comments.ts).
  const res = await gql<{ insert_np_comments_one: NpComment }>(CREATE_COMMENT, {
    todoId: input.todo_id,
    body: input.body,
    parentCommentId: input.parent_comment_id,
    idempotencyKey: input.idempotency_key,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_comments_one;
}

export async function updateComment(id: string, input: UpdateCommentInput): Promise<NpComment | null> {
  // UPDATE_COMMENT declares flat variables ($id, $body), not { id, input }.
  const res = await gql<{ update_np_comments_by_pk: NpComment }>(UPDATE_COMMENT, {
    id,
    body: input.body,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_comments_by_pk;
}

export async function deleteComment(id: string): Promise<boolean> {
  // Soft-delete: sets deleted_at
  const res = await gql<{ update_np_comments_by_pk: { id: string } }>(DELETE_COMMENT, { id });
  return !res.error && !!res.data?.update_np_comments_by_pk;
}
