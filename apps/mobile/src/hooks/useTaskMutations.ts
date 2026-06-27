/**
 * Purpose: Task, list, subtask, comment, and tag mutation hooks.
 * All operations target np_* tables via @nself/ntask-core operations.
 * SPORT: P5-C-mobile data layer rewire.
 */

import { useMutation } from 'urql';
import {
  CREATE_TODO, UPDATE_TODO, TOGGLE_TODO, DELETE_TODO,
  CREATE_LIST, UPDATE_LIST, DELETE_LIST,
  CREATE_SUBTASK, UPDATE_SUBTASK, TOGGLE_SUBTASK, DELETE_SUBTASK,
  CREATE_COMMENT, UPDATE_COMMENT, DELETE_COMMENT,
  CREATE_TAG, UPDATE_TAG, DELETE_TAG, ADD_TODO_TAG, REMOVE_TODO_TAG,
} from '../lib/hasura';

function idempotencyContext(idempotencyKey?: string) {
  return idempotencyKey
    ? { fetchOptions: { headers: { 'X-Idempotency-Key': idempotencyKey } } }
    : undefined;
}

export function useTaskMutations(listId?: string) {
  const [createResult, execCreate] = useMutation(CREATE_TODO);
  const [, execUpdate] = useMutation(UPDATE_TODO);
  const [, execToggle] = useMutation(TOGGLE_TODO);
  const [, execDelete] = useMutation(DELETE_TODO);
  const [, execCreateList] = useMutation(CREATE_LIST);
  const [, execUpdateList] = useMutation(UPDATE_LIST);
  const [, execDeleteList] = useMutation(DELETE_LIST);

  return {
    creating: createResult.fetching,

    createTask: (title: string, idempotencyKey?: string) =>
      execCreate({ listId, title }, idempotencyContext(idempotencyKey)),

    updateTask: (id: string, fields: Record<string, unknown>, idempotencyKey?: string) =>
      execUpdate({ id, ...fields }, idempotencyContext(idempotencyKey)),

    toggleTask: (id: string, completed: boolean, idempotencyKey?: string) =>
      execToggle({ id, completed }, idempotencyContext(idempotencyKey)),

    deleteTask: (id: string, idempotencyKey?: string) =>
      execDelete({ id }, idempotencyContext(idempotencyKey)),

    createList: (title: string, color = '#6366F1', idempotencyKey?: string) =>
      execCreateList({ title, color }, idempotencyContext(idempotencyKey)),

    updateList: (id: string, fields: Record<string, unknown>, idempotencyKey?: string) =>
      execUpdateList({ id, ...fields }, idempotencyContext(idempotencyKey)),

    deleteList: (id: string, idempotencyKey?: string) =>
      execDeleteList({ id }, idempotencyContext(idempotencyKey)),
  };
}

export function useSubtaskMutations() {
  const [createResult, execCreate] = useMutation(CREATE_SUBTASK);
  const [, execUpdate] = useMutation(UPDATE_SUBTASK);
  const [, execToggle] = useMutation(TOGGLE_SUBTASK);
  const [, execDelete] = useMutation(DELETE_SUBTASK);

  return {
    creating: createResult.fetching,
    createSubtask: (todoId: string, title: string, position?: number) =>
      execCreate({ todoId, title, position }),
    updateSubtask: (id: string, fields: { title?: string; isDone?: boolean; position?: number }) =>
      execUpdate({ id, ...fields }),
    toggleSubtask: (id: string, isDone: boolean) =>
      execToggle({ id, isDone }),
    deleteSubtask: (id: string) =>
      execDelete({ id }),
  };
}

export function useCommentMutations() {
  const [createResult, execCreate] = useMutation(CREATE_COMMENT);
  const [, execUpdate] = useMutation(UPDATE_COMMENT);
  const [, execDelete] = useMutation(DELETE_COMMENT);

  return {
    creating: createResult.fetching,
    createComment: (todoId: string, body: string, idempotencyKey?: string, parentCommentId?: string) =>
      execCreate({ todoId, body, idempotencyKey, parentCommentId }),
    updateComment: (id: string, body: string) =>
      execUpdate({ id, body }),
    deleteComment: (id: string) =>
      execDelete({ id }),
  };
}

export function useTagMutations() {
  const [createResult, execCreate] = useMutation(CREATE_TAG);
  const [, execUpdate] = useMutation(UPDATE_TAG);
  const [, execDelete] = useMutation(DELETE_TAG);
  const [, execAddTodoTag] = useMutation(ADD_TODO_TAG);
  const [, execRemoveTodoTag] = useMutation(REMOVE_TODO_TAG);

  return {
    creating: createResult.fetching,
    createTag: (name: string, color: string) =>
      execCreate({ name, color }),
    updateTag: (id: string, fields: { name?: string; color?: string }) =>
      execUpdate({ id, ...fields }),
    deleteTag: (id: string) =>
      execDelete({ id }),
    addTodoTag: (todoId: string, tagId: string) =>
      execAddTodoTag({ todoId, tagId }),
    removeTodoTag: (todoId: string, tagId: string) =>
      execRemoveTodoTag({ todoId, tagId }),
  };
}
