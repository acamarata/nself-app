/**
 * Purpose: Task data fetching hooks for ɳTask — wraps np_todos queries from @nself/ntask-core.
 * SPORT: P5-C-mobile data layer rewire.
 */

import { useQuery } from 'urql';
import { GET_LIST_TODOS, SEARCH_TODOS } from '../lib/hasura';
import type { NpTask } from '../types';

interface ListTodosData {
  np_todos: NpTask[];
}

/**
 * Fetch tasks for a list.
 */
export function useTasks(listId: string) {
  const [result, reexecuteQuery] = useQuery<ListTodosData>({
    query: GET_LIST_TODOS,
    variables: { listId },
    requestPolicy: 'cache-and-network',
  });

  const refetch = () => reexecuteQuery({ requestPolicy: 'network-only' });

  return {
    tasks: result.data?.np_todos ?? [],
    loading: result.fetching,
    error: result.error ?? null,
    errorMessage: result.error?.message ?? null,
    refetch,
  };
}

interface SearchData {
  np_todos: Pick<NpTask, 'id' | 'title' | 'completed' | 'priority' | 'due_date' | 'list_id'>[];
}

/**
 * Search tasks by title across all lists for the current user.
 */
export function useSearch(userId: string, query: string) {
  const paused = !query.trim();
  const [result, reexecuteQuery] = useQuery<SearchData>({
    query: SEARCH_TODOS,
    variables: { userId, q: `%${query.trim()}%`, limit: 50 },
    requestPolicy: 'cache-and-network',
    pause: paused,
  });

  return {
    results: result.data?.np_todos ?? [],
    loading: result.fetching && !paused,
    error: result.error ?? null,
    refetch: () => reexecuteQuery({ requestPolicy: 'network-only' }),
  };
}
