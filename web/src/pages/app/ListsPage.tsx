/**
 * ListsPage.tsx — /lists — all task lists
 *
 * Purpose:    Port of src/app/app/lists/page.tsx.
 * Inputs:     auth.getUser + getLists from @/lib/graphql
 * Outputs:    Grid of list cards with create action
 * Constraints: no Next.js imports
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useEffect, useState } from 'react'
import { auth } from '@/lib/api'
import { getLists, createList, type NpList } from '@/lib/graphql'
import { ListCard } from '@/components/tasks/ListCard'
import { ListSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { NewListModal } from '@/components/tasks/NewListModal'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

export function ListsPage() {
  usePageMeta({ title: 'My Lists' })
  const t = useT('tasks')
  const [lists, setLists] = useState<NpList[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewList, setShowNewList] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const userResult = await auth.getUser()
      if (userResult.error || !userResult.data) {
        setLoading(false)
        return
      }

      try {
        const lists = await getLists()
        setLists(lists)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('lists.loadFailed'))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreateList(title: string, color: string, icon: string) {
    const result = await createList({ title, color, icon })
    if (!result) throw new Error(t('lists.createFailed'))
    const refreshed = await getLists()
    setLists(refreshed)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('lists.title')}</h1>
        <button
          onClick={() => setShowNewList(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t('lists.newList')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <ListSkeleton />
      ) : lists.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t('lists.emptyTitle')}
          description={t('lists.emptyDescription')}
          action={
            <button
              onClick={() => setShowNewList(true)}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
            >
              {t('lists.createListCta')}
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}

      {showNewList && (
        <NewListModal onClose={() => setShowNewList(false)} onCreate={handleCreateList} />
      )}
    </div>
  )
}
