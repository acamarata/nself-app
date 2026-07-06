/**
 * Purpose: GraphQL query for the Today / Upcoming / Overdue smart view — a cross-list
 *          read of the current user's incomplete todos with a due_date. Mirrors the
 *          "Smart Views" feature documented in FEATURES.md (Today view, Overdue view).
 *          Not yet in @nself/ntask-core so defined inline here, following the
 *          lib/collabOps.ts precedent for local-first ops.
 * Inputs:  n/a (document node exports consumed by urql hooks)
 * Outputs: TypedDocumentNode-compatible gql tag objects
 * Constraints:
 *   - np_* table naming (post-Epic-A schema)
 *   - Row-level Hasura permission on np_todos (role: user) already scopes results to
 *     the caller's own rows via X-Hasura-User-Id — no user_id variable needed here.
 *   - Bucketing into Today / Upcoming / Overdue happens client-side (see useSmartViews)
 *     rather than as separate queries, to keep this to a single round trip.
 * SPORT: mobile/web parity delta — Smart Views (Today/Overdue) small mobile addition
 */

import { gql } from 'urql';

export interface SmartViewTask {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  due_date: string | null;
  list_id: string | null;
}

export interface MyOpenTasksData {
  np_todos: SmartViewTask[];
}

/**
 * All incomplete todos with a due_date set, across every list owned by the caller.
 * Ordered soonest-due-first so Today/Overdue buckets render in a sensible order
 * even before client-side grouping.
 */
export const GET_MY_OPEN_TASKS = gql`
  query GetMyOpenTasks {
    np_todos(
      where: { completed: { _eq: false }, due_date: { _is_null: false } }
      order_by: { due_date: asc }
    ) {
      id
      title
      completed
      priority
      due_date
      list_id
    }
  }
`;
