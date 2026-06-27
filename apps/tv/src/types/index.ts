/**
 * Purpose: Domain types for ɳTask TV — re-exported from @nself/ntask-core.
 * Constraints: TV surfaces the same domain model as mobile; no TV-specific domain types.
 * SPORT: Epic F — TV scaffold.
 */

export type {
  NpTask,
  NpTaskSummary,
  NpList,
  NpProfile,
  Priority,
} from '@nself/ntask-core';

// Convenience alias
export type { Priority as TaskPriority } from '@nself/ntask-core';
