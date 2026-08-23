/**
 * Purpose: Multi-select state machine + bulk task operations for ListScreen.
 * Inputs: BulkSelectionDeps — per-task mutation helpers from useTaskMutations,
 *         an isOffline flag, and the screen's refetch callback.
 * Outputs: selection state (selectionMode, isSelected, selectedCount) plus
 *          handlers (enterSelection, toggleSelection, exitSelection, runBulk,
 *          clearOverride, completedOverrideFor).
 * Constraints:
 *   - Selection mode is derived: it is active exactly while >= 1 task is
 *     selected, so deselecting the last row always leaves a sane UI (no
 *     selection mode with no visible way out).
 *   - Online bulk runs each mutation through the SAME useTaskMutations helpers
 *     as the per-row actions (no new GraphQL), then a single refetch.
 *   - Offline bulk enqueues one op per task with idempotency keys — identical
 *     payloads to the per-row offline path so the sync executor handles both.
 *   - completedOverrideFor feeds the optimistic completed state for rows the
 *     user just bulk-completed/uncompleted; each override self-expires at
 *     render time once refetched server data agrees with it.
 * SPORT: MB-5 multi-select and bulk operations on mobile
 */

import { useCallback, useState } from 'react';
import { enqueue } from '../lib/offline-queue';
import { generateIdempotencyKey } from '../lib/idempotency';

/** Result shape returned by the urql mutation helpers (the subset we need). */
interface MutationResult {
  error?: unknown;
}

interface BulkSelectionDeps {
  toggleTask: (id: string, completed: boolean) => Promise<MutationResult>;
  deleteTask: (id: string) => Promise<MutationResult>;
  isOffline: boolean;
  refetch: () => void;
}

export type BulkAction = 'complete' | 'uncomplete' | 'delete';

export function useBulkSelection({ toggleTask, deleteTask, isOffline, refetch }: BulkSelectionDeps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  // task id -> intended completed state, applied optimistically after a bulk toggle
  const [completedOverrides, setCompletedOverrides] = useState<Readonly<Record<string, boolean>>>({});

  const selectionMode = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const enterSelection = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /** Drop a row's optimistic completed state (its per-row checkbox was tapped). */
  const clearOverride = useCallback((id: string) => {
    setCompletedOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const runBulk = useCallback(async (action: BulkAction) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const completed = action === 'complete';
    for (const id of ids) {
      if (action === 'delete') {
        if (isOffline) {
          void enqueue('delete_task', { id }, generateIdempotencyKey('delete_task', id));
        } else {
          await deleteTask(id);
        }
      } else if (isOffline) {
        void enqueue(
          'toggle_task',
          { id, completed },
          generateIdempotencyKey('toggle_task', `${id}:${String(completed)}`),
        );
      } else {
        await toggleTask(id, completed);
      }
    }

    if (action !== 'delete') {
      const next: Record<string, boolean> = {};
      for (const id of ids) next[id] = completed;
      setCompletedOverrides(next);
    }
    exitSelection();
    if (!isOffline) refetch();
  }, [selectedIds, isOffline, toggleTask, deleteTask, refetch, exitSelection]);

  /** Optimistic completed state for a row; undefined means use the server value. */
  const completedOverrideFor = useCallback(
    (id: string) => completedOverrides[id],
    [completedOverrides],
  );

  return {
    selectionMode,
    selectedCount,
    isSelected,
    enterSelection,
    toggleSelection,
    exitSelection,
    runBulk,
    clearOverride,
    completedOverrideFor,
  };
}
