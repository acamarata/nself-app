/**
 * Purpose: Typed tag CRUD + todo↔tag junction ops over @nself/ntask-core operations.
 * Inputs: Tag operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpTag domain objects; tag_id string sets for a todo.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_TAGS,
  CREATE_TAG,
  UPDATE_TAG,
  DELETE_TAG,
  ADD_TODO_TAG,
  REMOVE_TODO_TAG,
} from '@nself/ntask-core';
import type { NpTag, CreateTagInput, UpdateTagInput } from '@nself/ntask-core';

export async function getTags(): Promise<NpTag[]> {
  const res = await gql<{ np_tags: NpTag[] }>(GET_TAGS);
  if (res.error || !res.data) return [];
  return res.data.np_tags;
}

export async function createTag(input: CreateTagInput): Promise<NpTag | null> {
  // CREATE_TAG declares flat variables ($name, $color), not a single $input
  // object (see packages/@nself/ntask-core/src/operations/tags.ts).
  const res = await gql<{ insert_np_tags_one: NpTag }>(CREATE_TAG, {
    name: input.name,
    color: input.color,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_tags_one;
}

export async function updateTag(id: string, input: UpdateTagInput): Promise<NpTag | null> {
  // UPDATE_TAG declares flat variables ($id, $name, $color), not { id, input }
  // (see packages/@nself/ntask-core/src/operations/tags.ts).
  const res = await gql<{ update_np_tags_by_pk: NpTag }>(UPDATE_TAG, {
    id,
    name: input.name,
    color: input.color,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_tags_by_pk;
}

export async function deleteTag(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_tags_by_pk: { id: string } }>(DELETE_TAG, { id });
  return !res.error && !!res.data?.delete_np_tags_by_pk;
}

// GET_TODO_TAGS is not yet in @nself/ntask-core (mirrors mobile's inline
// definition in apps/mobile/src/components/TagPicker.tsx) — returns just the
// tag_id junction rows for a single todo, used to derive the active tag set.
const GET_TODO_TAGS = /* GraphQL */`
  query GetTodoTags($todoId: uuid!) {
    np_todo_tags(where: { todo_id: { _eq: $todoId } }) {
      tag_id
    }
  }
`;

export async function getTodoTagIds(todoId: string): Promise<string[]> {
  const res = await gql<{ np_todo_tags: Array<{ tag_id: string }> }>(GET_TODO_TAGS, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_todo_tags.map((row) => row.tag_id);
}

// Bulk variant of GET_TODO_TAGS — fetches the tag_id junction rows for every
// todo in a list in one round trip, so a list-view tag filter (TagFilter) does
// not need an N+1 per-row query. Used by ListDetailPage.
const GET_TODO_TAGS_BULK = /* GraphQL */`
  query GetTodoTagsBulk($todoIds: [uuid!]) {
    np_todo_tags(where: { todo_id: { _in: $todoIds } }) {
      todo_id
      tag_id
    }
  }
`;

/** Returns a map of todo_id -> tag_id[] for the given todo ids. Empty input returns {}. */
export async function getTodoTagsForIds(todoIds: string[]): Promise<Record<string, string[]>> {
  if (todoIds.length === 0) return {};
  const res = await gql<{ np_todo_tags: Array<{ todo_id: string; tag_id: string }> }>(
    GET_TODO_TAGS_BULK,
    { todoIds },
  );
  if (res.error || !res.data) return {};
  const map: Record<string, string[]> = {};
  for (const row of res.data.np_todo_tags) {
    (map[row.todo_id] ??= []).push(row.tag_id);
  }
  return map;
}

export async function addTodoTag(todoId: string, tagId: string): Promise<boolean> {
  const res = await gql(ADD_TODO_TAG, { todoId, tagId });
  return !res.error;
}

export async function removeTodoTag(todoId: string, tagId: string): Promise<boolean> {
  const res = await gql(REMOVE_TODO_TAG, { todoId, tagId });
  return !res.error;
}
