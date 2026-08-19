/**
 * useListPermission.ts — React hook for current user's role in a shared list
 * Purpose:     Queries np_list_members via getListMembers() to determine the
 *              current user's role on a given list, exposing derived permission
 *              booleans (canEdit, canManageMembers) for UI gating.
 * Inputs:      listId — the np_lists.id to check membership for.
 * Outputs:     { role, canEdit, canManageMembers, loading, refetch }
 * Constraints: Returns role=null / loading=true until auth + query resolve.
 *              Re-fetches only when listId or user id changes.
 *              TS strict — no `any`, no implicit returns.
 * SPORT:       P5-W1-collab-list-permission
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getListMembers } from '@/lib/graphql-collab'
import type { MemberRole } from '@nself/ntask-core'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ListPermission {
  role: MemberRole | null
  canEdit: boolean
  canManageMembers: boolean
  loading: boolean
  refetch: () => Promise<void>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useListPermission(listId: string): ListPermission {
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = useState<MemberRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async (): Promise<void> => {
    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const members = await getListMembers(listId)
    const self = members.find((m) => m.user_id === user.id)
    setRole(self?.role ?? null)
    setLoading(false)
  }, [listId, user])

  useEffect(() => {
    if (authLoading) return
    void fetchRole()
  }, [fetchRole, authLoading])

  const canEdit = role === 'owner' || role === 'editor'
  const canManageMembers = role === 'owner'

  return {
    role,
    canEdit,
    canManageMembers,
    loading: loading || authLoading,
    refetch: fetchRole,
  }
}
