/**
 * InviteBanner.tsx — pending list-invite notification banner
 *
 * Purpose:    Polls np_list_shares for pending invitations addressed to the
 *             current user (accepted_at IS NULL, shared_with_email matches).
 *             Renders a dismissible banner row per invite with Accept/Decline
 *             actions. Returns null when there are no pending invites.
 * Inputs:     none (reads auth context for current user email)
 * Outputs:    Stack of dismissible invite banners above main content, or null
 * Constraints: No Radix. Refetches after each Accept/Decline to stay in sync.
 *              TS strict, no implicit any.
 * SPORT: P5-W1-collab-invite-banner
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getPendingInvites, acceptListInvite, declineListInvite } from '@/lib/graphql-collab'
import { useT } from '@/lib/i18n'
import type { NpListShare } from '@nself/ntask-core'

// ---------------------------------------------------------------------------
// Single banner row
// ---------------------------------------------------------------------------

interface BannerRowProps {
  share: NpListShare
  onAccepted: () => void
  onDeclined: () => void
  t: (key: string) => string
}

function BannerRow({ share, onAccepted, onDeclined, t }: BannerRowProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const role = share.permission
  const roleLabel = t(role === 'editor' ? 'collab.editor' : 'collab.viewer')
  // invited_by may be an email or display name depending on join; render as-is
  const inviterLabel = share.invited_by

  async function handleAccept() {
    setWorking(true)
    setError(null)
    const ok = await acceptListInvite(share.id)
    setWorking(false)
    if (ok) onAccepted()
    else setError(t('collab.acceptError'))
  }

  async function handleDecline() {
    setWorking(true)
    setError(null)
    const ok = await declineListInvite(share.id)
    setWorking(false)
    if (ok) onDeclined()
    else setError(t('collab.declineError'))
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 text-sm"
    >
      <div className="min-w-0">
        <p className="text-gray-900 dark:text-white">
          <span className="font-medium">{inviterLabel}</span>{' '}
          {t('collab.invitedBy').replace('{{name}}', inviterLabel).replace('{{list}}', share.list_id).replace('{{role}}', roleLabel)}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={working}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
        >
          {t('collab.accept')}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={working}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {t('collab.decline')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner container
// ---------------------------------------------------------------------------

export function InviteBanner() {
  const t = useT('tasks')
  const { user, loading: authLoading } = useAuth()
  const [pendingShares, setPendingShares] = useState<NpListShare[]>([])

  const fetchPending = useCallback(async (): Promise<void> => {
    if (!user?.email) return
    const pending = await getPendingInvites(user.email)
    setPendingShares(pending)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void fetchPending()
  }, [fetchPending, authLoading])

  function removeShare(id: string) {
    setPendingShares((prev) => prev.filter((s) => s.id !== id))
  }

  if (pendingShares.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 sm:px-6">
      {pendingShares.map((share) => (
        <BannerRow
          key={share.id}
          share={share}
          t={t}
          onAccepted={() => removeShare(share.id)}
          onDeclined={() => removeShare(share.id)}
        />
      ))}
    </div>
  )
}
