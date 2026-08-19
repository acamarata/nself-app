/**
 * graphql-saved-views.ts — Saved views GraphQL operations for ɳTask web
 * Purpose: Typed CRUD layer for np_saved_views.
 * Inputs: view name, filter/sort params.
 * Outputs: NpSavedView[] / NpSavedView | null / boolean.
 * Constraints: GQL strings + types now live in @nself/ntask-core (shared
 *              across surfaces); this file wires them to the web gql() client.
 * SPORT: D2-S7-T1
 */
import { gql } from './api.js';
import {
  GET_SAVED_VIEWS,
  CREATE_SAVED_VIEW,
  DELETE_SAVED_VIEW,
  UPDATE_SAVED_VIEW,
} from '@nself/ntask-core';
import type { FilterParams, NpSavedView } from '@nself/ntask-core';

export type { FilterParams, NpSavedView };

// ── API functions ──────────────────────────────────────────────────────────

export async function getSavedViews(): Promise<NpSavedView[]> {
  const res = await gql<{ np_saved_views: NpSavedView[] }>(GET_SAVED_VIEWS);
  if (res.error || !res.data) return [];
  return res.data.np_saved_views;
}

export async function createSavedView(
  name: string,
  filterParams: FilterParams,
  sortParams: Record<string, unknown>
): Promise<NpSavedView | null> {
  const res = await gql<{ insert_np_saved_views_one: NpSavedView }>(CREATE_SAVED_VIEW, {
    name,
    filters: filterParams,
    sort: sortParams,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_saved_views_one;
}

export async function deleteSavedView(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_saved_views_by_pk: { id: string } }>(DELETE_SAVED_VIEW, { id });
  return !res.error && !!res.data?.delete_np_saved_views_by_pk;
}

export async function updateSavedView(id: string, name: string): Promise<NpSavedView | null> {
  const res = await gql<{ update_np_saved_views_by_pk: NpSavedView }>(UPDATE_SAVED_VIEW, { id, name });
  if (res.error || !res.data) return null;
  return res.data.update_np_saved_views_by_pk;
}
