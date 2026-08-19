/**
 * vitest.shard.config.ts — one-shard coverage runner for the memory-bounded CI suite.
 *
 * Purpose:    Run a fixed subset of ntask's test files in a fresh vitest process
 *             so peak RSS stays well under the 3.7GB self-hosted "Web Tests"
 *             runner, and so cross-file-polluting pairs never co-reside.
 * Inputs:     NTASK_SHARD env ("1" | "2") selects which file group runs.
 * Outputs:    Per-shard istanbul JSON at coverage/shard-<N>/coverage-final.json
 *             (merged + threshold-checked by scripts/coverage-sharded.mjs).
 * Constraints: file lists are EXACT relative paths (no substring globs) so shards
 *             never overlap. pages.test.tsx and coverage-boost-3.test.tsx MUST
 *             stay in different shards — pages leaves the shared jsdom document
 *             in a state that breaks coverage-boost-3's inline-edit test when they
 *             run in the same worker (documented in scripts/coverage-sharded.mjs).
 * SOT:        web/ntask CI memory fix (2026-07-06)
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

// Balanced by rough file weight (~3.86k lines each), 13 files per shard.
const SHARDS: Record<string, string[]> = {
  '1': [
    'src/__tests__/pages.test.tsx',
    'src/__tests__/graphql-lib.test.ts',
    'src/__tests__/hooks-extended.test.ts',
    'src/__tests__/ui-components.test.tsx',
    'src/__tests__/coverage-hooks.test.ts',
    'src/__tests__/coverage-boost-1.test.tsx',
    'src/__tests__/coverage-board.test.tsx',
    'src/__tests__/d2-s7.test.tsx',
    'src/__tests__/auth-context.test.tsx',
    'src/hooks/__tests__/useDataExport.test.ts',
    'src/__tests__/account.test.ts',
    'src/__tests__/smoke.test.ts',
    'src/__tests__/collab.test.ts',
  ],
  '2': [
    'src/__tests__/coverage-boost-3.test.tsx',
    'src/__tests__/coverage-libs.test.ts',
    'src/__tests__/coverage-views-1.test.tsx',
    'src/__tests__/task-components.test.tsx',
    'src/__tests__/coverage-boost-2.test.tsx',
    'src/__tests__/coverage-calendar.test.tsx',
    'src/__tests__/auth.test.tsx',
    'src/__tests__/components.test.tsx',
    'src/__tests__/a11y.test.tsx',
    'src/__tests__/offline-queue.test.ts',
    'src/hooks/__tests__/useDeleteAccount.test.ts',
    'src/__tests__/lib.test.ts',
    'src/__tests__/hooks.test.ts',
  ],
}

const shard = process.env.NTASK_SHARD ?? '1'
const include = SHARDS[shard]
if (!include) {
  throw new Error(`vitest.shard.config: unknown NTASK_SHARD="${shard}" (expected "1" or "2")`)
}

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include,
      coverage: {
        // Emit raw istanbul JSON only; merge + text/lcov + thresholds happen in
        // scripts/coverage-sharded.mjs across the combined shards.
        reporter: ['json'],
        reportsDirectory: `coverage/shard-${shard}`,
        // Per-shard partial coverage must NOT gate — thresholds apply to the merge.
        thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      },
    },
  }),
)
