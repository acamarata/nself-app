/**
 * Purpose: Typed list-group ("sections") queries over @nself/ntask-core operations.
 * Inputs: GET_LIST_GROUPS operation string from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpListGroupRow rows for the current user.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import { GET_LIST_GROUPS } from '@nself/ntask-core';

export interface NpListGroupRow {
  id: string;
  title: string;
  color: string;
  icon: string;
  position: number;
}

/** Fetch the current user's list groups — used to check whether "sections" data exists. */
export async function getListGroups(): Promise<NpListGroupRow[]> {
  const res = await gql<{ np_list_groups: NpListGroupRow[] }>(GET_LIST_GROUPS);
  if (res.error || !res.data) return [];
  return res.data.np_list_groups;
}
