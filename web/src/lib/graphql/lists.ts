/**
 * Purpose: Typed list CRUD over @nself/ntask-core GraphQL operations.
 * Inputs: List operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpList domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_LISTS,
  CREATE_LIST,
  UPDATE_LIST,
  DELETE_LIST,
  mapGqlListToNpList,
} from '@nself/ntask-core';
import type { NpList, CreateListInput, UpdateListInput } from '@nself/ntask-core';

export async function getLists(): Promise<NpList[]> {
  const res = await gql<{ np_lists: unknown[] }>(GET_LISTS);
  if (res.error || !res.data) return [];
  return res.data.np_lists.map((item) => mapGqlListToNpList(item as Record<string, unknown>));
}

export async function createList(input: CreateListInput): Promise<NpList | null> {
  // CREATE_LIST declares flat variables ($title, $color, ...), not a single
  // $input object (see packages/@nself/ntask-core/src/operations/lists.ts).
  const res = await gql<{ insert_np_lists_one: unknown }>(CREATE_LIST, {
    title: input.title,
    color: input.color,
    icon: input.icon,
    description: input.description,
    groupId: input.group_id,
    position: input.position,
  });
  if (res.error || !res.data) return null;
  return mapGqlListToNpList(res.data.insert_np_lists_one as Record<string, unknown>);
}

export async function updateList(id: string, input: UpdateListInput): Promise<NpList | null> {
  // UPDATE_LIST likewise declares flat variables, not a single $input object.
  const res = await gql<{ update_np_lists_by_pk: unknown }>(UPDATE_LIST, {
    id,
    title: input.title,
    color: input.color,
    icon: input.icon,
    description: input.description,
    position: input.position,
    groupId: input.group_id,
  });
  if (res.error || !res.data) return null;
  return mapGqlListToNpList(res.data.update_np_lists_by_pk as Record<string, unknown>);
}

export async function deleteList(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_lists_by_pk: { id: string } }>(DELETE_LIST, { id });
  return !res.error && !!res.data?.delete_np_lists_by_pk;
}
