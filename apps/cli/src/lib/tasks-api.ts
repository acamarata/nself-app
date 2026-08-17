/**
 * Domain-level task/list operations shared by CLI commands and MCP tools.
 *
 * Purpose:    Thin, typed wrappers over the raw GraphQL operations (gql.ts)
 *             so both surfaces (terminal CLI, MCP server) share one
 *             implementation of "what a task/list operation means."
 * Inputs:     An ActiveSession (apiUrl + token) plus plain-object params.
 * Outputs:    Typed rows/arrays matching np_todos / np_lists shapes.
 * Constraints: Read-only lookups (list resolution by name) never mutate.
 *             Fuzzy list/task matching is case-insensitive substring match —
 *             good enough for CLI/agent ergonomics, not a search index.
 * SPORT:      Mirrors np_todos / np_lists (see ntask-core types) — not
 *             itself SPORT-tracked.
 */

import type { ActiveSession } from './session.js';
import { graphql } from './client.js';
import {
  GET_LISTS,
  GET_LIST_TODOS,
  GET_ALL_TODOS,
  GET_TODOS_DUE_BETWEEN,
  GET_TODOS_DUE_BEFORE,
  SEARCH_TODOS,
  CREATE_TODO,
  UPDATE_TODO,
  TOGGLE_TODO,
  DELETE_TODO,
  CREATE_LIST,
} from '../gql.js';

export interface TaskList {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly icon: string | null;
  readonly is_default: boolean;
  readonly position: number;
}

export interface Task {
  readonly id: string;
  readonly list_id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly completed: boolean;
  readonly priority: string | null;
  readonly notes?: string | null;
  readonly due_date: string | null;
  readonly position: number;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export async function getLists(session: ActiveSession): Promise<TaskList[]> {
  const data = await graphql<{ np_lists: TaskList[] }>(session.apiUrl, session.token, GET_LISTS);
  return data.np_lists;
}

/** Case-insensitive substring match on list title; returns the best (first) match. */
export async function findListByName(session: ActiveSession, name: string): Promise<TaskList | undefined> {
  const lists = await getLists(session);
  const needle = name.trim().toLowerCase();
  return (
    lists.find((l) => l.title.toLowerCase() === needle) ??
    lists.find((l) => l.title.toLowerCase().includes(needle))
  );
}

export async function getListTodos(session: ActiveSession, listId: string): Promise<Task[]> {
  const data = await graphql<{ np_todos: Task[] }>(session.apiUrl, session.token, GET_LIST_TODOS, { listId });
  return data.np_todos;
}

export async function getAllTodos(session: ActiveSession, completed?: boolean): Promise<Task[]> {
  // Hasura rejects `{ completed: { _eq: null } }` — omit the key entirely when unset
  // rather than passing an explicit null comparator (see gql.ts note on GET_ALL_TODOS).
  const where = completed === undefined ? {} : { completed: { _eq: completed } };
  const data = await graphql<{ np_todos: Task[] }>(session.apiUrl, session.token, GET_ALL_TODOS, { where });
  return data.np_todos;
}

export async function getTodosDueBetween(session: ActiveSession, start: string, end: string): Promise<Task[]> {
  const data = await graphql<{ np_todos: Task[] }>(session.apiUrl, session.token, GET_TODOS_DUE_BETWEEN, {
    start,
    end,
  });
  return data.np_todos;
}

export async function getTodosDueBefore(session: ActiveSession, end: string): Promise<Task[]> {
  const data = await graphql<{ np_todos: Task[] }>(session.apiUrl, session.token, GET_TODOS_DUE_BEFORE, { end });
  return data.np_todos;
}

export async function searchTodos(session: ActiveSession, q: string, limit = 20): Promise<Task[]> {
  const data = await graphql<{ np_todos: Task[] }>(session.apiUrl, session.token, SEARCH_TODOS, {
    q: `%${q}%`,
    limit,
  });
  return data.np_todos;
}

export interface CreateTaskInput {
  readonly listId: string;
  readonly title: string;
  readonly priority?: string;
  readonly description?: string;
  readonly notes?: string;
  readonly dueDate?: string;
  readonly position?: number;
}

export async function createTodo(session: ActiveSession, input: CreateTaskInput): Promise<Task> {
  const data = await graphql<{ insert_np_todos_one: Task }>(session.apiUrl, session.token, CREATE_TODO, input);
  return data.insert_np_todos_one;
}

export interface UpdateTaskInput {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly completed?: boolean;
  readonly priority?: string;
  readonly notes?: string;
  readonly dueDate?: string;
  readonly position?: number;
}

export async function updateTodo(session: ActiveSession, input: UpdateTaskInput): Promise<Task> {
  const data = await graphql<{ update_np_todos_by_pk: Task }>(session.apiUrl, session.token, UPDATE_TODO, input);
  return data.update_np_todos_by_pk;
}

export async function toggleTodo(session: ActiveSession, id: string, completed: boolean): Promise<Task> {
  const data = await graphql<{ update_np_todos_by_pk: Task }>(session.apiUrl, session.token, TOGGLE_TODO, {
    id,
    completed,
  });
  return data.update_np_todos_by_pk;
}

export async function deleteTodo(session: ActiveSession, id: string): Promise<{ id: string; title: string } | null> {
  const data = await graphql<{ delete_np_todos_by_pk: { id: string; title: string } | null }>(
    session.apiUrl,
    session.token,
    DELETE_TODO,
    { id },
  );
  return data.delete_np_todos_by_pk;
}

export interface CreateListInput {
  readonly title: string;
  readonly color?: string;
  readonly icon?: string;
  readonly description?: string;
  readonly position?: number;
}

export async function createList(session: ActiveSession, input: CreateListInput): Promise<TaskList> {
  const data = await graphql<{ insert_np_lists_one: TaskList }>(session.apiUrl, session.token, CREATE_LIST, input);
  return data.insert_np_lists_one;
}

/** Fuzzy-find a task by exact id, or by case-insensitive title substring within a list of tasks. */
export function findTaskByIdOrTitle(tasks: Task[], idOrFuzzy: string): Task | undefined {
  const exact = tasks.find((t) => t.id === idOrFuzzy);
  if (exact) return exact;
  const needle = idOrFuzzy.trim().toLowerCase();
  return (
    tasks.find((t) => t.title.toLowerCase() === needle) ??
    tasks.find((t) => t.title.toLowerCase().includes(needle))
  );
}
