/**
 * AssigneeSelector.tsx — Assign/unassign task to list members
 * Purpose: Shown on TaskDetailPanel for tasks on shared lists; lets any member
 *          toggle other members as assignees on np_todo_assignees.
 * Inputs: todoId, listId.
 * Outputs: Avatar chips for current assignees + a dropdown to add/remove members.
 * Constraints: Renders nothing when the list has no other members (personal list).
 *              <200 lines; a11y via aria-checked chip semantics.
 * SPORT: D2-S7 assignees UX.
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { getListMembers } from '@/lib/graphql-collab'
import { getTodoAssignees, assignTodo, unassignTodo } from '@/lib/graphql-collab'
import type { NpListMember } from '@nself/ntask-core'

interface AssigneeSelectorProps {
  todoId: string
  listId: string | null
}

function initials(name?: string | null, email?: string | null): string {
  const src = name ?? email ?? '?'
  return src.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)
}

export function AssigneeSelector({ todoId, listId }: AssigneeSelectorProps) {
  const t = useT('tasks')
  const [members, setMembers] = useState<NpListMember[]>([])
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!listId) { setLoading(false); return }
    async function load() {
      const [memberResult, assigneeResult] = await Promise.all([
        getListMembers(listId as string),
        getTodoAssignees(todoId),
      ])
      if (!cancelled) {
        setMembers(memberResult)
        setAssigneeIds(assigneeResult.map((a) => a.assignee_id))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [todoId, listId])

  // Personal (unshared) lists have no members row beyond the owner — hide entirely.
  if (!listId || loading || members.length === 0) return null

  async function handleToggle(userId: string) {
    setWorking(true)
    if (assigneeIds.includes(userId)) {
      await unassignTodo(todoId, userId)
      setAssigneeIds((prev) => prev.filter((id) => id !== userId))
    } else {
      await assignTodo(todoId, userId)
      setAssigneeIds((prev) => [...prev, userId])
    }
    setWorking(false)
  }

  const assigned = members.filter((m) => assigneeIds.includes(m.user_id))

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('assignees.title')}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-xs font-medium text-brand-primary hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {open ? t('createTask.cancel') : t('assignees.assign')}
        </button>
      </div>

      {assigned.length === 0 && !open && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('assignees.empty')}</p>
      )}

      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 pl-1 pr-2 py-0.5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {initials(m.profile?.display_name, m.profile?.email)}
              </span>
              <span className="text-xs text-indigo-700 dark:text-indigo-300">
                {m.profile?.display_name ?? m.profile?.email ?? t('assignees.member')}
              </span>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((m) => {
            const active = assigneeIds.includes(m.user_id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleToggle(m.user_id)}
                disabled={working}
                role="checkbox"
                aria-checked={active}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shrink-0">
                  {initials(m.profile?.display_name, m.profile?.email)}
                </span>
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                  {m.profile?.display_name ?? m.profile?.email}
                </span>
                {active && (
                  <svg className="h-4 w-4 text-brand-primary shrink-0" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
