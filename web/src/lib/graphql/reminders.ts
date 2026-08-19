/**
 * Purpose: Typed reminder CRUD over @nself/ntask-core GraphQL operations.
 * Inputs: Reminder operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpReminder domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_REMINDERS,
  CREATE_REMINDER,
  UPDATE_REMINDER,
  DELETE_REMINDER,
} from '@nself/ntask-core';
import type { NpReminder, CreateReminderInput, UpdateReminderInput } from '@nself/ntask-core';

export async function getReminders(todoId: string): Promise<NpReminder[]> {
  const res = await gql<{ np_reminders: NpReminder[] }>(GET_REMINDERS, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_reminders;
}

export async function createReminder(input: CreateReminderInput): Promise<NpReminder | null> {
  // CREATE_REMINDER declares flat variables ($todoId, $remindAt, $channel), not
  // a single $input object (see packages/@nself/ntask-core/src/operations/reminders.ts).
  const res = await gql<{ insert_np_reminders_one: NpReminder }>(CREATE_REMINDER, {
    todoId: input.todo_id,
    remindAt: input.remind_at,
    channel: input.channel,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_reminders_one;
}

export async function updateReminder(id: string, input: UpdateReminderInput): Promise<NpReminder | null> {
  const res = await gql<{ update_np_reminders_by_pk: NpReminder }>(UPDATE_REMINDER, {
    id,
    remindAt: input.remind_at,
    channel: input.channel,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_reminders_by_pk;
}

export async function deleteReminder(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_reminders_by_pk: { id: string } | null }>(DELETE_REMINDER, { id });
  return !res.error && !!res.data?.delete_np_reminders_by_pk;
}
