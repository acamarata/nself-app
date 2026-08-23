/**
 * Purpose: Build optimistic pending-task stubs for the instant-create UX on
 *          ListScreen (offline-enqueued and online-optimistic paths share it).
 * Inputs: tempId, title, listId, position, optional dueDate.
 * Outputs: An NpTask with pending=true and server-column stubs filled.
 * Constraints:
 *   - Stub fields mirror the np_todos column defaults so row renderers never
 *     see undefined while the server round-trip is in flight.
 *   - pending=true fades the row and blocks taps until server data replaces it.
 * SPORT: T-P3-E5-W3-S1-T01-b optimistic pending state; extracted from
 *        ListScreen during MB-5 to keep that file under the 300-line limit.
 */

import type { NpTask } from '../types';

/** A task with the pending-optimistic flag used by ListScreen rendering. */
export interface OptimisticTask extends NpTask {
  pending: true;
}

/** Server-column stubs for a task that has no server row yet. */
const OPTIMISTIC_DEFAULTS = {
  user_id: '',
  description: '',
  is_public: false,
  notes: '',
  source_account_id: 'primary',
  requires_approval: false,
  requires_photo: false,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  rejection_reason: null,
} as const;

export function makeOptimisticTask(input: {
  tempId: string;
  title: string;
  listId: string;
  position: number;
  dueDate: string | null;
}): OptimisticTask {
  const now = new Date().toISOString();
  return {
    ...OPTIMISTIC_DEFAULTS,
    id: input.tempId,
    title: input.title,
    completed: false,
    list_id: input.listId,
    position: input.position,
    priority: 'none',
    due_date: input.dueDate,
    created_at: now,
    updated_at: now,
    pending: true,
  };
}
