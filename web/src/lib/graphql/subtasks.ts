/**
 * Purpose: Typed subtask CRUD over @nself/ntask-core GraphQL operations.
 * Inputs: Subtask operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpSubtask domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_SUBTASKS,
  CREATE_SUBTASK,
  UPDATE_SUBTASK,
  TOGGLE_SUBTASK,
  DELETE_SUBTASK,
} from '@nself/ntask-core';
import type { NpSubtask, CreateSubtaskInput, UpdateSubtaskInput } from '@nself/ntask-core';

export async function getSubtasks(todoId: string): Promise<NpSubtask[]> {
  const res = await gql<{ np_subtasks: NpSubtask[] }>(GET_SUBTASKS, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_subtasks;
}

export async function createSubtask(input: CreateSubtaskInput): Promise<NpSubtask | null> {
  // CREATE_SUBTASK declares flat variables ($todoId, $title, $position), not a
  // single $input object (see packages/@nself/ntask-core/src/operations/subtasks.ts).
  const res = await gql<{ insert_np_subtasks_one: NpSubtask }>(CREATE_SUBTASK, {
    todoId: input.todo_id,
    title: input.title,
    position: input.position,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_subtasks_one;
}

export async function updateSubtask(id: string, input: UpdateSubtaskInput): Promise<NpSubtask | null> {
  // UPDATE_SUBTASK likewise declares flat variables ($id, $title, $isDone, $position).
  const res = await gql<{ update_np_subtasks_by_pk: NpSubtask }>(UPDATE_SUBTASK, {
    id,
    title: input.title,
    isDone: input.is_done,
    position: input.position,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_subtasks_by_pk;
}

export async function toggleSubtask(id: string, isDone: boolean): Promise<boolean> {
  const res = await gql<{ update_np_subtasks_by_pk: { id: string } }>(TOGGLE_SUBTASK, { id, isDone });
  return !res.error && !!res.data?.update_np_subtasks_by_pk;
}

export async function deleteSubtask(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_subtasks_by_pk: { id: string } }>(DELETE_SUBTASK, { id });
  return !res.error && !!res.data?.delete_np_subtasks_by_pk;
}
