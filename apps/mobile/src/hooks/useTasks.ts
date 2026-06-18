/**
 * Purpose: Task data fetching and cache management for a given list
 * Inputs: listId string, urql Client in context (via Provider)
 * Outputs: { tasks, loading, error, refetch }
 * Constraints: Uses urql useQuery with network-only request policy.
 *   Replaces @apollo/client useQuery per D-P3-REACT19 / E2 @nself/graphql-client wiring.
 * SPORT: Port of app/lib/providers/tasks_provider.dart
 */

import { useQuery } from 'urql';
import { GET_TASKS } from '../lib/hasura';
import type { Task } from '../types';

interface TasksData {
  app_tasks: Task[];
}

export function useTasks(listId: string) {
  const [result, reexecuteQuery] = useQuery<TasksData>({
    query: GET_TASKS,
    variables: { listId },
    requestPolicy: 'cache-and-network',
  });

  const refetch = () => reexecuteQuery({ requestPolicy: 'network-only' });

  return {
    tasks: result.data?.app_tasks ?? [],
    loading: result.fetching,
    /** Raw urql CombinedError — pass to classifyUrqlError() for typed TaskError */
    error: result.error ?? null,
    /** Short message string for simple display cases */
    errorMessage: result.error?.message ?? null,
    refetch,
  };
}
