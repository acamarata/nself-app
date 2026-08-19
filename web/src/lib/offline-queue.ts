/**
 * Purpose: Web offline mutation queue using @nself/offline-queue + IndexedDB adapter.
 * Inputs: Mutation type strings and payloads from UI actions.
 * Outputs: Persisted queue drained on reconnect via drain().
 * Constraints: Browser-only (IndexedDB); no-ops in SSR/Node.
 * SPORT: D-S1-T3 offline queue rewire.
 */
import { QueueProcessor } from '@nself/offline-queue';
import type { QueuedMutation } from '@nself/offline-queue';
import { IdbAdapter } from '@nself/offline-queue/adapters/idb';

const adapter = new IdbAdapter('ntask-offline-v2', 'mutations');

/**
 * Default executor: re-plays a queued mutation against the GraphQL endpoint.
 * Mutations are stored with their full payload, so this is fire-and-forget best-effort sync.
 */
async function defaultExecutor(mutation: QueuedMutation): Promise<void> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(mutation.payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export const offlineQueue = new QueueProcessor(adapter, defaultExecutor, {
  maxRetries: 3,
  backoffMs: 500,
});

export type { QueuedMutation } from '@nself/offline-queue';
