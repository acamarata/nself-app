/**
 * Purpose: Task data fetching hooks for ɳTask TV dashboard — today/upcoming/overdue splits.
 * Inputs: none (reads auth context via urql client injected by TVNavigator)
 * Outputs: { todayTasks, upcomingTasks, overdueTasks, lists, loading, error, refetch }
 * Constraints:
 *   - Uses GET_LIST_TODOS and GET_LISTS from @nself/ntask-core — same ops as mobile.
 *   - TV is READ-ONLY: no create/update hooks exported from this module (out of scope per D4).
 *     TOGGLE_TODO (mark-done) is the sole write op; exported as useMarkDone separately.
 *   - Date bucketing (today/upcoming/overdue) is done client-side from ISO due_date strings.
 *     Hasura does not get separate queries per bucket — we fetch all and split in memory.
 *   - Tasks without a due_date appear in "Upcoming" only (not overdue, not today).
 *   - "Today" = due_date equals today's date in local timezone.
 *   - "Overdue" = due_date < today.
 *   - "Upcoming" = due_date >= tomorrow OR no due_date.
 *   - requestPolicy: 'cache-and-network' — TV always shows stale data immediately,
 *     then updates silently when fresh data arrives (glanceable UX).
 * SPORT: Epic F — TV scaffold.
 */

import { useMemo } from 'react';
import { useQuery, useMutation } from 'urql';
import { GET_LISTS, GET_LIST_TODOS, TOGGLE_TODO } from '@nself/ntask-core';
import type { NpTask, NpList } from '@nself/ntask-core';

// ─── Date bucket helpers ───────────────────────────────────────────────────────

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketTask(task: NpTask, today: string): 'today' | 'overdue' | 'upcoming' {
  if (!task.due_date) return 'upcoming';
  const due = task.due_date.substring(0, 10); // 'YYYY-MM-DD'
  if (due === today) return 'today';
  if (due < today) return 'overdue';
  return 'upcoming';
}

// ─── Lists hook ───────────────────────────────────────────────────────────────

interface GetListsData {
  np_lists: NpList[];
}

/** Fetch all lists for the current user. */
export function useTVLists() {
  const [result, reexecute] = useQuery<GetListsData>({
    query: GET_LISTS,
    requestPolicy: 'cache-and-network',
  });

  return {
    lists: result.data?.np_lists ?? [],
    loading: result.fetching,
    error: result.error ?? null,
    refetch: () => reexecute({ requestPolicy: 'network-only' }),
  };
}

// ─── Dashboard hook ────────────────────────────────────────────────────────────

interface GetListTodosData {
  np_todos: NpTask[];
}

/**
 * Fetch tasks for a single list and split into today/upcoming/overdue buckets.
 * Used by DashboardScreen to render the three glance card columns.
 */
export function useTVListTasks(listId: string) {
  const [result, reexecute] = useQuery<GetListTodosData>({
    query: GET_LIST_TODOS,
    variables: { listId },
    requestPolicy: 'cache-and-network',
    pause: !listId,
  });

  const today = todayDateString();

  const { todayTasks, upcomingTasks, overdueTasks } = useMemo(() => {
    const allTasks = result.data?.np_todos ?? [];
    const incomplete = allTasks.filter((t) => !t.completed);
    const buckets = { todayTasks: [] as NpTask[], upcomingTasks: [] as NpTask[], overdueTasks: [] as NpTask[] };
    for (const task of incomplete) {
      const bucket = bucketTask(task, today);
      if (bucket === 'today') buckets.todayTasks.push(task);
      else if (bucket === 'overdue') buckets.overdueTasks.push(task);
      else buckets.upcomingTasks.push(task);
    }
    return buckets;
  }, [result.data, today]);

  return {
    todayTasks,
    upcomingTasks,
    overdueTasks,
    loading: result.fetching,
    error: result.error ?? null,
    refetch: () => reexecute({ requestPolicy: 'network-only' }),
  };
}

// ─── Mark done hook ────────────────────────────────────────────────────────────

interface ToggleTodoResult {
  update_np_todos_by_pk: { id: string; completed: boolean } | null;
}

/**
 * useMarkDone — sole write operation in ɳTask TV (D4 scope: mark-done via remote select).
 * Returns { markDone, loading } — call markDone(taskId) on remote OK press.
 */
export function useMarkDone() {
  const [result, execToggle] = useMutation<ToggleTodoResult>(TOGGLE_TODO);

  const markDone = (taskId: string) => execToggle({ id: taskId, completed: true });

  return {
    markDone,
    loading: result.fetching,
    error: result.error ?? null,
  };
}
