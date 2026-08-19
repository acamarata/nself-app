/**
 * collab.test.ts — shape tests for collaboration modules
 *
 * Verifies that exported symbols from graphql-collab, hooks, and components
 * are the expected types. No DOM render required — pure structural assertions.
 *
 * Full integration tests: components.test.tsx (ShareListDialog, RoleSelector)
 * E2E collab flows: e2e/collab.spec.ts (Playwright)
 */

import { describe, it, expect } from 'vitest'

describe('graphql-collab module exports', () => {
  it('exports collab mutation/query functions', async () => {
    const mod = await import('../lib/graphql-collab')
    expect(typeof mod.createListInvite).toBe('function')
    expect(typeof mod.removeMember).toBe('function')
    expect(typeof mod.updateMemberRole).toBe('function')
    expect(typeof mod.createShareLink).toBe('function')
    expect(typeof mod.revokeShareLink).toBe('function')
    expect(typeof mod.acceptListInvite).toBe('function')
  })
})

describe('useListPermission hook', () => {
  it('is exported as a function', async () => {
    const mod = await import('../hooks/useListPermission')
    expect(typeof mod.useListPermission).toBe('function')
  })
})

describe('usePresenceHeartbeat hook', () => {
  it('is exported as a function', async () => {
    const mod = await import('../hooks/usePresenceHeartbeat')
    expect(typeof mod.usePresenceHeartbeat).toBe('function')
  })
})

describe('RoleSelector component', () => {
  it('is exported as a function (React component)', async () => {
    const mod = await import('../components/collaboration/RoleSelector')
    expect(typeof mod.RoleSelector).toBe('function')
  })
})
