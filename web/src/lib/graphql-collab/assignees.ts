/**
 * Purpose: Todo assignee ops (np_todo_assignees — migration 015).
 *          Ops promoted to @nself/ntask-core/src/operations/assignees.ts.
 * Inputs:  todoId, assigneeId.
 * Outputs: Typed NpTodoAssignee rows and success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import { ASSIGN_TODO, UNASSIGN_TODO, GET_TODO_ASSIGNEES } from '@nself/ntask-core';

export interface NpTodoAssignee {
  id: string;
  todo_id: string;
  assignee_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export async function getTodoAssignees(todoId: string): Promise<NpTodoAssignee[]> {
  const res = await gql<{ np_todo_assignees: NpTodoAssignee[] }>(GET_TODO_ASSIGNEES, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_todo_assignees;
}

export async function assignTodo(todoId: string, assigneeId: string): Promise<boolean> {
  const res = await gql(ASSIGN_TODO, { todoId, assigneeId });
  return !res.error;
}

export async function unassignTodo(todoId: string, assigneeId: string): Promise<boolean> {
  const res = await gql(UNASSIGN_TODO, { todoId, assigneeId });
  return !res.error;
}
