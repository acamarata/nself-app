/**
 * Purpose: Typed todo CRUD + search + cross-list queries over @nself/ntask-core operations.
 * Inputs: Todo operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpTask / NpTaskSummary domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_LIST_TODOS,
  GET_TODO,
  SEARCH_TODOS,
  CREATE_TODO,
  UPDATE_TODO,
  TOGGLE_TODO,
  DELETE_TODO,
  mapGqlTaskToNpTask,
  mapGqlTaskToSummary,
} from '@nself/ntask-core';
import type { NpTask, NpTaskSummary, CreateTaskInput, UpdateTaskInput } from '@nself/ntask-core';

export async function getListTodos(listId: string): Promise<NpTaskSummary[]> {
  const res = await gql<{ np_todos: unknown[] }>(GET_LIST_TODOS, { listId });
  if (res.error || !res.data) return [];
  return res.data.np_todos.map((item) => mapGqlTaskToSummary(item as Record<string, unknown>));
}

export async function getTodo(id: string): Promise<NpTask | null> {
  const res = await gql<{ np_todos_by_pk: unknown }>(GET_TODO, { id });
  if (res.error || !res.data) return null;
  return mapGqlTaskToNpTask(res.data.np_todos_by_pk as Record<string, unknown>);
}

export async function searchTodos(query: string, limit = 20): Promise<NpTaskSummary[]> {
  const res = await gql<{ np_todos: unknown[] }>(SEARCH_TODOS, { query: `%${query}%`, limit });
  if (res.error || !res.data) return [];
  return res.data.np_todos.map((item) => mapGqlTaskToSummary(item as Record<string, unknown>));
}

export async function createTodo(input: CreateTaskInput): Promise<NpTask | null> {
  // CREATE_TODO declares flat variables ($listId, $title, ...), not a single
  // $input object — map the snake_case CreateTaskInput fields to the
  // mutation's actual camelCase variable names (see
  // packages/@nself/ntask-core/src/operations/tasks.ts).
  const res = await gql<{ insert_np_todos_one: unknown }>(CREATE_TODO, {
    listId: input.list_id,
    title: input.title,
    priority: input.priority,
    description: input.description,
    notes: input.notes,
    dueDate: input.due_date,
    position: input.position,
  });
  if (res.error || !res.data) return null;
  return mapGqlTaskToNpTask(res.data.insert_np_todos_one as Record<string, unknown>);
}

export async function updateTodo(id: string, input: UpdateTaskInput): Promise<NpTask | null> {
  // UPDATE_TODO likewise declares flat variables, not a single $input object.
  const res = await gql<{ update_np_todos_by_pk: unknown }>(UPDATE_TODO, {
    id,
    title: input.title,
    description: input.description,
    completed: input.completed,
    priority: input.priority,
    notes: input.notes,
    dueDate: input.due_date,
    position: input.position,
  });
  if (res.error || !res.data) return null;
  return mapGqlTaskToNpTask(res.data.update_np_todos_by_pk as Record<string, unknown>);
}

export async function toggleTodo(id: string, isDone: boolean): Promise<boolean> {
  // TOGGLE_TODO declares $completed, not $isDone (see
  // packages/@nself/ntask-core/src/operations/tasks.ts).
  const res = await gql<{ update_np_todos_by_pk: { id: string } }>(TOGGLE_TODO, { id, completed: isDone });
  return !res.error && !!res.data?.update_np_todos_by_pk;
}

export async function deleteTodo(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_todos_by_pk: { id: string } }>(DELETE_TODO, { id });
  return !res.error && !!res.data?.delete_np_todos_by_pk;
}

// ── Cross-list Todo Queries (app-local — not shared via ntask-core) ────────
//
// Purpose: view pages (Today/Upcoming/Inbox/Logbook/Calendar/Board) need todos
// across ALL of a user's lists, not scoped to one list_id like GET_LIST_TODOS.
// Hasura row-level security already scopes np_todos to the caller's JWT, so no
// explicit user_id filter is required (matches the GET_LISTS/GET_LIST_TODOS
// pattern used elsewhere in this data layer).
// SPORT: view pages — Today/Upcoming/Inbox/Logbook/Calendar/Board.

const GET_ALL_TODOS = /* GraphQL */ `
  query GetAllTodos {
    np_todos(order_by: { position: asc, created_at: asc }) {
      id
      user_id
      list_id
      title
      description
      completed
      priority
      notes
      due_date
      position
      source_account_id
      created_at
      updated_at
      requires_approval
      requires_photo
    }
  }
`;

/** Fetch every todo owned by the current user, across all lists (RLS-scoped). */
export async function getAllTodos(): Promise<NpTask[]> {
  const res = await gql<{ np_todos: unknown[] }>(GET_ALL_TODOS);
  if (res.error || !res.data) return [];
  return res.data.np_todos.map((item) => mapGqlTaskToNpTask(item as Record<string, unknown>));
}
