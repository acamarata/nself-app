/**
 * Purpose: Barrel for the typed GraphQL data layer over @nself/ntask-core + api.ts gql().
 *          Split by domain (lists/todos/subtasks/tags/comments/recurring/profile/
 *          reminders/list-groups) per the ASI 300-line file cap; consumers keep
 *          importing from '@/lib/graphql' unchanged.
 * Inputs: GraphQL operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: Typed result objects using @nself/ntask-core domain types.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */

// Re-export domain types for consumers
export type {
  NpList,
  NpTask,
  NpTaskSummary,
  NpSubtask,
  NpTag,
  NpComment,
  NpRecurringRule,
  NpProfile,
  NpUserPreferences,
  NpReminder,
  Priority,
  TaskStatus,
} from '@nself/ntask-core';

export * from './lists';
export * from './todos';
export * from './subtasks';
export * from './tags';
export * from './comments';
export * from './recurring';
export * from './profile';
export * from './reminders';
export * from './list-groups';
