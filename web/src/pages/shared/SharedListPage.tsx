/**
 * SharedListPage.tsx — Public share view at /shared/:token
 *
 * Purpose:    Allow unauthenticated users to view (or edit) a list via a share token.
 *             No AppShell — fully public, standalone page.
 * Inputs:     token from URL params; resolves to { list, todos } via getSharedList()
 * Outputs:    Read-only or editable checklist + upsell CTA. Sets document.title on mount.
 * Constraints: No authentication required. Checkboxes disabled for 'view' permission.
 *              'edit' permission wires up updateTodo. Shows expiry error for invalid tokens.
 *              WCAG: semantic <main>, <h1> for list title, role="list" for todo rows.
 * SPORT:      T-P5-E1-shared-list
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSharedList, updateSharedTodo } from '@/lib/graphql-collab'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

interface SharedTodo {
  id: string
  title: string
  completed: boolean
  position: number
}

import type { SharedListResult } from '@/lib/graphql-collab'

type SharedListData = SharedListResult

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  )
}

function InvalidLinkCard({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl" aria-hidden="true">🔗</div>
        <h1 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('collab.shared.invalidTitle')}
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {t('collab.shared.invalidBody')}
        </p>
        <Link
          to="/signup"
          className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          {t('collab.shared.signupCta')}
        </Link>
      </div>
    </div>
  )
}

function UpsellCard({ t }: { t: (key: string) => string }) {
  return (
    <div className="mt-10 rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-6 text-center">
      <p className="mb-1 text-base font-semibold text-indigo-900 dark:text-indigo-100">
        {t('collab.shared.upsellHeading')}
      </p>
      <p className="mb-4 text-sm text-indigo-700 dark:text-indigo-300">
        {t('collab.shared.upsellBody')}
      </p>
      <Link
        to="/signup"
        className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        {t('collab.shared.signupCta')}
      </Link>
    </div>
  )
}

export function SharedListPage() {
  const { token } = useParams<{ token: string }>()
  const t = useT('tasks')

  const [state, setState] = useState<'loading' | 'invalid' | 'ready'>('loading')
  const [sharedData, setSharedData] = useState<SharedListData | null>(null)
  const [localTodos, setLocalTodos] = useState<SharedTodo[]>([])

  const load = useCallback(async () => {
    if (!token) {
      setState('invalid')
      return
    }
    const result = await getSharedList(token)
    if (!result) {
      setState('invalid')
      return
    }
    setSharedData(result)
    setLocalTodos(result.todos)
    document.title = `${result.list.title} — ${t('collab.shared.pageTitle')}`
    setState('ready')
  }, [token, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleToggle(todo: SharedTodo) {
    if (!sharedData || sharedData.list.permission !== 'edit') return
    // Optimistic update
    setLocalTodos((prev) =>
      prev.map((td) => (td.id === todo.id ? { ...td, completed: !td.completed } : td)),
    )
    const ok = await updateSharedTodo(todo.id, !todo.completed)
    if (!ok) {
      // Revert on failure
      setLocalTodos((prev) =>
        prev.map((td) => (td.id === todo.id ? { ...td, completed: todo.completed } : td)),
      )
    }
  }

  if (state === 'loading') return <Spinner />
  if (state === 'invalid' || !sharedData) return <InvalidLinkCard t={t} />

  const { list } = sharedData
  const isEditable = list.permission === 'edit'
  const sorted = [...localTodos].sort((a, b) => a.position - b.position)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Minimal public header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400 select-none">
          ɳTask
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            {isEditable ? t('collab.shared.permissionEdit') : t('collab.shared.permissionView')}
          </span>
        </div>

        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {list.title}
        </h1>

        {sorted.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-12">
            {t('collab.shared.emptyList')}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            {sorted.map((todo) => (
              <li key={todo.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  disabled={!isEditable}
                  onChange={() => void handleToggle(todo)}
                  aria-label={todo.title}
                  className={[
                    'h-4 w-4 rounded border-gray-300 dark:border-gray-600',
                    'text-indigo-600 focus:ring-indigo-500',
                    !isEditable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  ].join(' ')}
                />
                <span
                  className={[
                    'flex-1 text-sm',
                    todo.completed
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-800 dark:text-gray-200',
                  ].join(' ')}
                >
                  {todo.title}
                </span>
              </li>
            ))}
          </ul>
        )}

        <UpsellCard t={t} />
      </main>
    </div>
  )
}
