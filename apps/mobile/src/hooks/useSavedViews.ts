/**
 * Purpose: Load a user's saved filter views, and apply one to a task list.
 * Inputs: urql GET_SAVED_VIEWS / DELETE_SAVED_VIEW from @nself/ntask-core.
 * Outputs: { views, loading, error, refetch, remove } and applyFilters().
 * Constraints:
 *   - Filtering is done client-side over the caller's open tasks rather than
 *     pushed into the GraphQL where-clause. np_saved_views.filters is a jsonb
 *     blob written by the web client, so its shape is not guaranteed; building
 *     a where-clause from untrusted jsonb risks a query that errors outright,
 *     whereas an unknown filter value here simply matches nothing.
 *   - Sorting mirrors the web client: unknown sortField falls back to due date.
 * SPORT: P5-C-mobile — saved views parity with web.
 */

import { useQuery, useMutation } from 'urql';
import { GET_SAVED_VIEWS, DELETE_SAVED_VIEW } from '@nself/ntask-core';
import type { NpSavedView, FilterParams } from '@nself/ntask-core';
import type { SmartViewTask } from '../lib/smartViewsOps';

interface SavedViewsData {
  np_saved_views: NpSavedView[];
}

/**
 * Apply a saved view's filters and sort to a task list.
 *
 * Exported separately from the hook so it can be unit-tested without a urql
 * provider, and reused by any screen that already has tasks in hand.
 */
export function applyFilters(tasks: SmartViewTask[], filters?: FilterParams | null): SmartViewTask[] {
  if (!filters) return tasks;

  let out = tasks;

  if (filters.status === 'active') out = out.filter((t) => !t.completed);
  else if (filters.status === 'completed') out = out.filter((t) => t.completed);

  // A saved view may name a priority that no longer exists; that legitimately
  // matches nothing rather than being ignored.
  if (filters.priority && filters.priority !== 'all') {
    out = out.filter((t) => t.priority === filters.priority);
  }

  const dir = filters.sortDir === 'desc' ? -1 : 1;
  const field = filters.sortField;

  return [...out].sort((a, b) => {
    if (field === 'title') return a.title.localeCompare(b.title) * dir;
    if (field === 'priority') return String(a.priority).localeCompare(String(b.priority)) * dir;
    // Default and 'due_date': tasks with no due date sort last regardless of
    // direction — an undated task is not "earliest", it is unscheduled.
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return (new Date(a.due_date).getTime() - new Date(b.due_date).getTime()) * dir;
  });
}

export function useSavedViews() {
  const [result, refetch] = useQuery<SavedViewsData>({
    query: GET_SAVED_VIEWS,
    requestPolicy: 'cache-and-network',
  });
  const [, execDelete] = useMutation(DELETE_SAVED_VIEW);

  return {
    views: result.data?.np_saved_views ?? [],
    loading: result.fetching,
    error: result.error ? 'Could not load saved views.' : null,
    refetch: () => refetch({ requestPolicy: 'network-only' }),
    remove: async (id: string): Promise<boolean> => {
      const res = await execDelete({ id });
      return !res.error;
    },
  };
}
