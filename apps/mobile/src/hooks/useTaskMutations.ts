/**
 * Purpose: Task and list mutation hooks — create, update, toggle, delete; idempotency-keyed
 * Outputs: Mutation functions; urql invalidates cache via document-based cache exchange
 * Constraints:
 *   - Replaces @apollo/client useMutation per D-P3-REACT19 / E2 wiring.
 *   - idempotencyKey: optional header sent with ALL mutations (create/update/toggle/delete)
 *     for server-side dedup — required so the offline queue can safely replay any mutation type.
 *   - urql doesn't have refetchQueries — cache invalidation handled automatically
 *     by the cacheExchange when mutations return affected entities.
 * SPORT: T-P3-E5-W3-S1-T01-c idempotency + T01-a offline mutations
 */

import { useMutation } from 'urql';
import {
  CREATE_TASK, UPDATE_TASK, TOGGLE_TASK, DELETE_TASK,
  CREATE_LIST, UPDATE_LIST, DELETE_LIST,
} from '../lib/hasura';

/**
 * Build urql operation context that carries the idempotency header, or undefined
 * when no key is supplied. Used by every mutation so the offline queue can replay
 * any mutation type safely (server dedups on X-Idempotency-Key).
 */
function idempotencyContext(idempotencyKey?: string) {
  return idempotencyKey
    ? { fetchOptions: { headers: { 'X-Idempotency-Key': idempotencyKey } } }
    : undefined;
}

export function useTaskMutations(listId?: string) {
  const [createTaskResult, execCreateTask] = useMutation(CREATE_TASK);
  const [, execUpdateTask] = useMutation(UPDATE_TASK);
  const [, execToggleTask] = useMutation(TOGGLE_TASK);
  const [, execDeleteTask] = useMutation(DELETE_TASK);
  const [, execCreateList] = useMutation(CREATE_LIST);
  const [, execUpdateList] = useMutation(UPDATE_LIST);
  const [, execDeleteList] = useMutation(DELETE_LIST);

  return {
    creating: createTaskResult.fetching,

    /**
     * Create a task.
     * @param title - Task title (pre-validated by caller via taskCreateSchema)
     * @param idempotencyKey - Optional key for server-side deduplication on retry
     */
    createTask: (title: string, idempotencyKey?: string) =>
      execCreateTask({ listId, title }, idempotencyContext(idempotencyKey)),

    updateTask: (id: string, fields: Record<string, unknown>, idempotencyKey?: string) =>
      execUpdateTask({ id, ...fields }, idempotencyContext(idempotencyKey)),

    toggleTask: (id: string, completed: boolean, idempotencyKey?: string) =>
      execToggleTask({ id, completed }, idempotencyContext(idempotencyKey)),

    deleteTask: (id: string, idempotencyKey?: string) =>
      execDeleteTask({ id }, idempotencyContext(idempotencyKey)),

    createList: (title: string, color = '#6366F1', idempotencyKey?: string) =>
      execCreateList({ title, color }, idempotencyContext(idempotencyKey)),

    updateList: (id: string, fields: Record<string, unknown>, idempotencyKey?: string) =>
      execUpdateList({ id, ...fields }, idempotencyContext(idempotencyKey)),

    deleteList: (id: string, idempotencyKey?: string) =>
      execDeleteList({ id }, idempotencyContext(idempotencyKey)),
  };
}
