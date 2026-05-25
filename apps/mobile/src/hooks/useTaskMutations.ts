/**
 * Purpose: Task and list mutation hooks — create, update, toggle, delete
 * Outputs: Mutation functions with Apollo cache invalidation
 * Constraints: All mutations refetch affected queries after completion
 * SPORT: Port of Flutter BackendService list/task write methods
 */

import { useMutation } from '@apollo/client';
import {
  CREATE_TASK, UPDATE_TASK, TOGGLE_TASK, DELETE_TASK,
  CREATE_LIST, UPDATE_LIST, DELETE_LIST,
  GET_TASKS, GET_LISTS,
} from '../lib/hasura';

export function useTaskMutations(listId?: string) {
  const refetchTasks = listId ? [{ query: GET_TASKS, variables: { listId } }] : [];
  const refetchLists = [{ query: GET_LISTS }];

  const [createTask, { loading: creating }] = useMutation(CREATE_TASK, { refetchQueries: refetchTasks });
  const [updateTask] = useMutation(UPDATE_TASK, { refetchQueries: refetchTasks });
  const [toggleTask] = useMutation(TOGGLE_TASK, { refetchQueries: refetchTasks });
  const [deleteTask] = useMutation(DELETE_TASK, { refetchQueries: refetchTasks });
  const [createList] = useMutation(CREATE_LIST, { refetchQueries: refetchLists });
  const [updateList] = useMutation(UPDATE_LIST, { refetchQueries: refetchLists });
  const [deleteList] = useMutation(DELETE_LIST, { refetchQueries: refetchLists });

  return {
    creating,
    createTask: (title: string) =>
      createTask({ variables: { listId, title } }),
    updateTask: (id: string, fields: Record<string, unknown>) =>
      updateTask({ variables: { id, ...fields } }),
    toggleTask: (id: string, completed: boolean) =>
      toggleTask({ variables: { id, completed } }),
    deleteTask: (id: string) =>
      deleteTask({ variables: { id } }),
    createList: (title: string, color = '#6366F1') =>
      createList({ variables: { title, color } }),
    updateList: (id: string, fields: Record<string, unknown>) =>
      updateList({ variables: { id, ...fields } }),
    deleteList: (id: string) =>
      deleteList({ variables: { id } }),
  };
}
