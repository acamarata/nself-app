/**
 * ListMembersPanel.tsx — collaboration members list for a task list
 *
 * Purpose:    Renders all np_list_members rows for a list. Owner sees per-row
 *             role selector and "Remove" action. Non-owner sees own "Leave list"
 *             button. Uses useListPermission to gate owner-only controls.
 * Inputs:     listId: string, optional onClose callback
 * Outputs:    Member rows: avatar initials + display name/email + role badge +
 *             contextual actions
 * Constraints: No Radix, no external component lib. <300 lines.
 * SPORT: P5-W1-collab-members-panel
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useListPermission } from '@/hooks/useListPermission'
import { getListMembers, removeMember, updateMemberRole, leaveList } from '@/lib/graphql-collab'
import { useT } from '@/lib/i18n'
import type { NpListMember, MemberRole } from '@nself/ntask-core'

interface ListMembersPanelProps {
  listId: string
  onClose?: () => void
}

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  editor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function initials(name?: string, email?: string): string {
  const src = name ?? email ?? '?'
  return src
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

interface MemberRowProps {
  member: NpListMember
  isOwner: boolean
  isSelf: boolean
  listId: string
  onAction: () => Promise<void>
  onLeave: () => Promise<void>
  t: (key: string) => string
}

function MemberRow({ member, isOwner, isSelf, listId, onAction, onLeave, t }: MemberRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const displayName = member.profile?.display_name
  const email = member.profile?.email ?? ''
  const label = displayName ?? email

  async function handleRemove() {
    if (!confirming) { setConfirming(true); return }
    setWorking(true)
    setError(null)
    const ok = await removeMember(listId, member.user_id)
    if (ok) {
      await onAction()
      setConfirming(false)
    } else {
      setError(t('collab.removeError'))
    }
    setWorking(false)
  }

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as MemberRole
    setWorking(true)
    setError(null)
    const ok = await updateMemberRole(listId, member.user_id, next)
    if (ok) {
      await onAction()
    } else {
      setError(t('collab.roleChangeError'))
    }
    setWorking(false)
  }

  async function handleLeave() {
    setWorking(true)
    await onLeave()
    setWorking(false)
  }

  return (
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-xs font-bold text-white"
          aria-hidden="true"
        >
          {initials(displayName, email)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          {displayName && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
          )}
        </div>

        {member.role === 'owner' || !isOwner ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[member.role]}`}>
            {t(`collab.role${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}`)}
          </span>
        ) : (
          <select
            value={member.role}
            onChange={handleRoleChange}
            disabled={working}
            aria-label={t('collab.changeRole')}
            className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="viewer">{t('collab.roleViewer')}</option>
            <option value="editor">{t('collab.roleEditor')}</option>
          </select>
        )}

        {isOwner && member.role !== 'owner' && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={working}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              confirming
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            {confirming ? t('collab.confirmRemove') : t('collab.remove')}
          </button>
        )}

        {isSelf && member.role !== 'owner' && (
          <button
            type="button"
            onClick={handleLeave}
            disabled={working}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {t('collab.leaveList')}
          </button>
        )}
      </div>
      {error && (
        <p className="pl-11 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

export function ListMembersPanel({ listId, onClose }: ListMembersPanelProps) {
  const t = useT('tasks')
  const { user } = useAuth()
  const { canManageMembers: isOwner } = useListPermission(listId)
  const navigate = useNavigate()
  const [members, setMembers] = useState<NpListMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const data = await getListMembers(listId)
    setMembers(data)
    setLoading(false)
  }, [listId])

  useEffect(() => { void fetchMembers() }, [fetchMembers])

  async function handleLeave() {
    if (!user) return
    await leaveList(listId, user.id)
    onClose?.()
    navigate('/lists', { replace: true })
  }

  if (loading) {
    return (
      <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500 animate-pulse">
        {t('states.loading')}
      </p>
    )
  }

  if (members.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
        {t('collab.noMembers')}
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          listId={listId}
          isOwner={isOwner}
          isSelf={user?.id === m.user_id}
          onAction={fetchMembers}
          onLeave={handleLeave}
          t={t}
        />
      ))}
    </div>
  )
}
