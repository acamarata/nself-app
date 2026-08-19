/**
 * Purpose: Typed recurring-rule CRUD over @nself/ntask-core GraphQL operations.
 * Inputs: Recurring operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpRecurringRule domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_RECURRING_RULES,
  CREATE_RECURRING_RULE,
  UPDATE_RECURRING_RULE,
  DELETE_RECURRING_RULE,
} from '@nself/ntask-core';
import type {
  NpRecurringRule,
  CreateRecurringRuleInput,
  UpdateRecurringRuleInput,
} from '@nself/ntask-core';

export async function getRecurringRules(todoId: string): Promise<NpRecurringRule[]> {
  const res = await gql<{ np_recurring_rules: NpRecurringRule[] }>(GET_RECURRING_RULES, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_recurring_rules;
}

export async function createRecurringRule(input: CreateRecurringRuleInput): Promise<NpRecurringRule | null> {
  // CREATE_RECURRING_RULE declares flat variables ($todoId, $frequency, ...),
  // not a single $input object (see
  // packages/@nself/ntask-core/src/operations/recurring.ts).
  const res = await gql<{ insert_np_recurring_rules_one: NpRecurringRule }>(CREATE_RECURRING_RULE, {
    todoId: input.todo_id,
    frequency: input.frequency,
    intervalCount: input.interval_count,
    byDay: input.by_day,
    startDate: input.start_date,
    endDate: input.end_date,
    untilDate: input.until_date,
    countLimit: input.count_limit,
  });
  if (res.error || !res.data) return null;
  return res.data.insert_np_recurring_rules_one;
}

export async function updateRecurringRule(id: string, input: UpdateRecurringRuleInput): Promise<NpRecurringRule | null> {
  // UPDATE_RECURRING_RULE declares flat variables matching UpdateRecurringRuleInput
  // (see packages/@nself/ntask-core/src/operations/recurring.ts), not { id, input }.
  const res = await gql<{ update_np_recurring_rules_by_pk: NpRecurringRule }>(UPDATE_RECURRING_RULE, {
    id,
    frequency: input.frequency,
    intervalCount: input.interval_count,
    byDay: input.by_day,
    byMonthDay: input.by_month_day,
    byMonth: input.by_month,
    untilDate: input.until_date,
    countLimit: input.count_limit,
    endDate: input.end_date,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_recurring_rules_by_pk;
}

export async function deleteRecurringRule(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_recurring_rules_by_pk: { id: string } }>(DELETE_RECURRING_RULE, { id });
  return !res.error && !!res.data?.delete_np_recurring_rules_by_pk;
}
