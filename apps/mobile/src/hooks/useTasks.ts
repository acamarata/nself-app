/**
 * Purpose: Task data fetching and cache management for a given list
 * Inputs: listId string, Apollo client in context
 * Outputs: { tasks, loading, error, refetch }
 * Constraints: Uses Apollo cache-and-network; mirrors Flutter tasksProvider
 * SPORT: Port of app/lib/providers/tasks_provider.dart
 */

import { useQuery } from '@apollo/client';
import { GET_TASKS } from '../lib/hasura';
import type { Task } from '../types';

interface TasksData {
  app_tasks: Task[];
}

export function useTasks(listId: string) {
  const { data, loading, error, refetch } = useQuery<TasksData>(GET_TASKS, {
    variables: { listId },
    fetchPolicy: 'cache-and-network',
  });

  return {
    tasks: data?.app_tasks ?? [],
    loading,
    error: error?.message ?? null,
    refetch,
  };
}
