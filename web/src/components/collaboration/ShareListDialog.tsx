/**
 * ShareListDialog.tsx — share/invite modal for a task list
 *
 * Purpose:    Three-tab modal (Invite | Share Link | Members) for managing
 *             list collaboration. Invite sends email invitations; Share Link
 *             generates/revokes public share tokens; Members renders
 *             ListMembersPanel inline.
 * Inputs:     listId: string, onClose: () => void
 * Outputs:    Backdrop modal with tabbed collaboration controls
 * Constraints: Same backdrop/card pattern as NewListModal. role="dialog"/
 *              aria-modal/aria-labelledby + real focus trap + Escape + focus
 *              restore via the shared useFocusTrap hook
 *              (src/hooks/useFocusTrap.ts). No Radix. <300 lines — tab
 *              content extracted to local components.
 * SPORT: P5-W1-collab-share-dialog
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useT } from '@/lib/i18n'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import {
  createListInvite,
  createShareLink,
  getListShares,
  revokeShareLink,
} from '@/lib/graphql-collab'
import { RoleSelector } from './RoleSelector'
import { ListMembersPanel } from './ListMembersPanel'
import type { NpListShare } from '@nself/ntask-core'

type TabId = 'invite' | 'link' | 'members'
type Role = 'viewer' | 'editor'

const TABS: Array<{ id: TabId; labelKey: string }> = [
  { id: 'invite', labelKey: 'collab.tabInvite' },
  { id: 'link', labelKey: 'collab.tabLink' },
  { id: 'members', labelKey: 'collab.tabMembers' },
]

// ---------------------------------------------------------------------------
// Invite tab
// ---------------------------------------------------------------------------

interface InviteTabProps {
  listId: string
  t: (key: string) => string
}

function InviteTab({ listId, t }: InviteTabProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('collab.invalidEmail'))
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    const result = await createListInvite(listId, trimmed, role)
    setLoading(false)
    if (result) {
      setSuccess(t('collab.inviteSent').replace('{email}', trimmed))
      setEmail('')
    } else {
      setError(t('collab.inviteError'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-1">
      {success && (
        <p className="rounded-md bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="invite-email" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('collab.emailLabel')}
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('collab.emailPlaceholder')}
          required
          autoFocus
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('collab.roleLabel')}
        </span>
        <RoleSelector value={role} onChange={setRole} disabled={loading} />
      </div>
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t('collab.sending') : t('collab.sendInvite')}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Share Link tab
// ---------------------------------------------------------------------------

interface ShareLinkTabProps {
  listId: string
  t: (key: string) => string
}

function ShareLinkTab({ listId, t }: ShareLinkTabProps) {
  const [linkShare, setLinkShare] = useState<NpListShare | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('viewer')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExisting = useCallback(async () => {
    const shares = await getListShares(listId)
    // token-based shares have no shared_with_email (empty string or null-ish)
    const tokenShare = shares.find((s) => !s.shared_with_email || s.shared_with_email === '')
    if (tokenShare?.token) {
      setLinkShare(tokenShare)
      // Route is /shared/:token (see App.tsx) — must use the share token, not the row id.
      const base = window.location.origin
      setShareUrl(`${base}/shared/${tokenShare.token}`)
    }
  }, [listId])

  useEffect(() => { void loadExisting() }, [loadExisting])

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const result = await createShareLink(listId, role)
    if (result) {
      setShareUrl(result.shareUrl)
      // Refresh to get the full NpListShare object
      await loadExisting()
    } else {
      setError(t('collab.shareLinkError'))
    }
    setLoading(false)
  }

  async function handleRevoke() {
    if (!linkShare) return
    setLoading(true)
    setError(null)
    const ok = await revokeShareLink(linkShare.id)
    if (ok) {
      setLinkShare(null)
      setShareUrl(null)
    } else {
      setError(t('collab.revokeError'))
    }
    setLoading(false)
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3 pt-1">
      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div>
        <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('collab.linkPermission')}
        </span>
        <RoleSelector value={role} onChange={setRole} disabled={loading || !!linkShare} />
      </div>

      {shareUrl ? (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? t('collab.copied') : t('collab.copy')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={loading}
            className="w-full rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {t('collab.revokeLink')}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {loading ? t('collab.generating') : t('collab.generateLink')}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog shell
// ---------------------------------------------------------------------------

interface ShareListDialogProps {
  listId: string
  onClose: () => void
}

export function ShareListDialog({ listId, onClose }: ShareListDialogProps) {
  const t = useT('tasks')
  const [activeTab, setActiveTab] = useState<TabId>('invite')
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, onClose)

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-list-dialog-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6 outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="share-list-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
            {t('collab.shareTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('collab.close')}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'invite' && <InviteTab listId={listId} t={t} />}
        {activeTab === 'link' && <ShareLinkTab listId={listId} t={t} />}
        {activeTab === 'members' && <ListMembersPanel listId={listId} onClose={onClose} />}
      </div>
    </div>
  )
}
