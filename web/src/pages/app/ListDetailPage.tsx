/**
 * ListDetailPage.tsx — /lists/:listId — todo list detail
 *
 * Purpose:    Port of src/app/app/lists/[listId]/page.tsx.
 *             Next.js `use(params)` → useParams from react-router-dom.
 * Inputs:     listId from URL params; GraphQL todos
 * Outputs:    Paginated todo list with filter tabs and add input
 * Constraints: useParams replaces use(params); no Next.js imports
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  getListTodos, createTodo, toggleTodo, deleteTodo, updateTodo,
  getLists, getTags, addTodoTag, getTodoTagsForIds,
  type NpTaskSummary, type NpList, type NpTag, type Priority,
} from '@/lib/graphql'
import { createSavedView, type NpSavedView } from '@/lib/graphql-saved-views'
import { TodoItem } from '@/components/tasks/TodoItem'
import { NewTodoInput } from '@/components/tasks/NewTodoInput'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { BulkActionBar } from '@/components/tasks/BulkActionBar'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { TagFilter } from '@/components/tasks/TagFilter'
import { FilterSortPanel, type FilterState, type SortState } from '@/components/tasks/FilterSortPanel'
import { useT } from '@/lib/i18n'
import { useSubscription } from '@/hooks/useSubscription'
import { SUBSCRIBE_LIST_TODOS } from '@nself/ntask-core'

const DEFAULT_FILTER: FilterState = { status: 'all', priority: 'all', tagIds: [] }
const DEFAULT_SORT: SortState = { field: 'created_at', direction: 'desc' }

/** Saved-view apply event dispatched by SavedViewsList (sidebar) — see graphql-saved-views.ts. */
const APPLY_EVENT = 'ntask:saved-view-apply'

function applyFilterAndSort(
  todos: NpTaskSummary[],
  filter: FilterState,
  sort: SortState,
  todoTagIds: (todo: NpTaskSummary) => string[],
): NpTaskSummary[] {
  let result = todos

  if (filter.status === 'active') result = result.filter((t) => !t.completed)
  if (filter.status === 'completed') result = result.filter((t) => t.completed)
  if (filter.priority !== 'all') result = result.filter((t) => t.priority === filter.priority)
  if (filter.tagIds.length > 0) {
    result = result.filter((t) => todoTagIds(t).some((id) => filter.tagIds.includes(id)))
  }

  const dir = sort.direction === 'asc' ? 1 : -1
  const priorityRank: Record<Priority, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 }
  result = [...result].sort((a, b) => {
    switch (sort.field) {
      case 'title':
        return dir * a.title.localeCompare(b.title)
      case 'due_date':
        return dir * ((a.due_date ? new Date(a.due_date).getTime() : 0) - (b.due_date ? new Date(b.due_date).getTime() : 0))
      case 'priority':
        return dir * (priorityRank[a.priority] - priorityRank[b.priority])
      default:
        return 0 // created_at: preserve server order (already created_at-ordered)
    }
  })
  if (sort.field === 'created_at' && sort.direction === 'asc') result = [...result].reverse()

  return result
}

export function ListDetailPage() {
  const t = useT('tasks')
  const { listId } = useParams<{ listId: string }>()
  const [todos, setTodos] = useState<NpTaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [todoTagMap, setTodoTagMap] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lists, setLists] = useState<NpList[]>([])
  const [tags, setTags] = useState<NpTag[]>([])
  const [openTodoId, setOpenTodoId] = useState<string | null>(null)

  const loadTodos = useCallback(async () => {
    if (!listId) return
    const result = await getListTodos(listId)
    setTodos(result)
    setLoading(false)
    const tagMap = await getTodoTagsForIds(result.map((todo) => todo.id))
    setTodoTagMap(tagMap)
  }, [listId])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // Loaded lazily for the bulk-action bar (move-to-list / add-tag targets)
  // and the tag-filter chip row.
  useEffect(() => {
    Promise.all([getLists(), getTags()]).then(([listResult, tagResult]) => {
      setLists(listResult)
      setTags(tagResult)
    })
  }, [])

  // Apply a saved view (dispatched by SavedViewsList in the sidebar) to this
  // page's local filter/sort state.
  useEffect(() => {
    function onApplyView(e: Event) {
      const detail = (e as CustomEvent<{ view: NpSavedView }>).detail
      const view = detail?.view
      if (!view) return
      setFilter({ status: view.filters.status, priority: view.filters.priority as FilterState['priority'], tagIds: view.filters.tagIds })
      setSort({ field: view.filters.sortField as SortState['field'], direction: view.filters.sortDir })
    }
    window.addEventListener(APPLY_EVENT, onApplyView)
    return () => window.removeEventListener(APPLY_EVENT, onApplyView)
  }, [])

  // Real-time subscription — merges server updates with local optimistic state
  const { data: subData } = useSubscription<{ np_todos: NpTaskSummary[] }>(
    SUBSCRIBE_LIST_TODOS,
    { listId },
    { enabled: !!listId },
  )

  // Merge subscription updates with local state (subscription wins on conflict)
  useEffect(() => {
    if (subData?.np_todos) {
      setTodos(subData.np_todos)
    }
  }, [subData])

  async function handleAdd(title: string) {
    if (!listId) return
    const result = await createTodo({
      list_id: listId,
      title,
      priority: 'none',
    })
    if (!result) {
      setError('Failed to create task')
      return
    }
    setTodos((prev) => [...prev, result])
  }

  async function handleToggle(id: string, isDone: boolean) {
    const ok = await toggleTodo(id, isDone)
    if (ok) {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: isDone } : t)),
      )
    }
  }

  async function handleDelete(id: string) {
    const ok = await deleteTodo(id)
    if (ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id))
    }
  }

  async function handleSnooze(id: string, nextDueDate: string) {
    const updated = await updateTodo(id, { due_date: nextDueDate })
    if (updated) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: updated.due_date } : t)))
    }
  }

  function toggleSelectMode() {
    setSelecting((v) => !v)
    setSelectedIds(new Set())
  }

  function handleSelectToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelecting(false)
  }

  async function handleBulkComplete() {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => toggleTodo(id, true)))
    setTodos((prev) => prev.map((t) => (selectedIds.has(t.id) ? { ...t, completed: true } : t)))
    clearSelection()
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => deleteTodo(id)))
    setTodos((prev) => prev.filter((t) => !selectedIds.has(t.id)))
    clearSelection()
  }

  async function handleBulkMove(targetListId: string) {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => updateTodo(id, { list_id: targetListId })))
    setTodos((prev) => prev.filter((t) => !selectedIds.has(t.id)))
    clearSelection()
  }

  async function handleBulkPriority(priority: Priority) {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => updateTodo(id, { priority })))
    setTodos((prev) => prev.map((t) => (selectedIds.has(t.id) ? { ...t, priority } : t)))
    clearSelection()
  }

  async function handleBulkAddTag(tagId: string) {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => addTodoTag(id, tagId)))
    clearSelection()
  }

  async function handleSaveView() {
    const name = window.prompt(t('savedViews.title'))
    if (!name || !name.trim()) return
    await createSavedView(
      name.trim(),
      { status: filter.status, priority: filter.priority, tagIds: filter.tagIds, sortField: sort.field, sortDir: sort.direction },
      { field: sort.field, direction: sort.direction },
    )
  }

  const todoTagIds = useCallback((todo: NpTaskSummary) => todoTagMap[todo.id] ?? [], [todoTagMap])
  const visible = applyFilterAndSort(todos, filter, sort, todoTagIds)
  const activeCount = todos.filter((t) => !t.completed).length
  const isFilterDirty =
    filter.status !== DEFAULT_FILTER.status ||
    filter.priority !== DEFAULT_FILTER.priority ||
    filter.tagIds.length > 0 ||
    sort.field !== DEFAULT_SORT.field ||
    sort.direction !== DEFAULT_SORT.direction
  const isEmptyFromFilter = !loading && todos.length > 0 && visible.length === 0

  return (
    <div className="flex flex-col h-full pb-24 lg:pb-0">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-700/50">
        <NewTodoInput onAdd={handleAdd} />

        {tags.length > 0 && (
          <div className="px-4 pt-2">
            <TagFilter
              selectedTagIds={filter.tagIds}
              onTagToggle={(id) =>
                setFilter((prev) => ({
                  ...prev,
                  tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((t) => t !== id) : [...prev.tagIds, id],
                }))
              }
            />
          </div>
        )}

        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterPanelOpen(true)}
            aria-pressed={isFilterDirty}
            className={clsx(
              'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isFilterDirty
                ? 'bg-indigo-100 text-brand-primary dark:bg-indigo-900/40 dark:text-brand-muted'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            {t('filter.title')}
          </button>
          {isFilterDirty && (
            <button
              type="button"
              onClick={handleSaveView}
              className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              {t('savedViews.title')}
            </button>
          )}
          <span className="ml-auto flex-shrink-0 text-xs text-gray-400 tabular-nums">
            {activeCount} remaining
          </span>
          <button
            type="button"
            onClick={toggleSelectMode}
            aria-pressed={selecting}
            className={clsx(
              'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selecting
                ? 'bg-indigo-100 text-brand-primary dark:bg-indigo-900/40 dark:text-brand-muted'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            {selecting ? t('bulk.exitSelectMode') : t('bulk.enterSelectMode')}
          </button>
        </div>
      </div>

      {filterPanelOpen && (
        <FilterSortPanel
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onClose={() => setFilterPanelOpen(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-4">
            <TodoSkeleton />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={isEmptyFromFilter ? '🔍' : '✅'}
            title={isEmptyFromFilter ? t('filter.all') : t('emptyState.noTasksYet')}
            description={isEmptyFromFilter ? undefined : 'Add a task above to get started.'}
          />
        ) : (
          <div className="py-2">
            {visible.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSnooze={handleSnooze}
                selectable={selecting}
                selected={selectedIds.has(todo.id)}
                onSelectToggle={handleSelectToggle}
                onOpenDetail={setOpenTodoId}
              />
            ))}
          </div>
        )}
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        lists={lists}
        tags={tags}
        currentListId={listId}
        onComplete={handleBulkComplete}
        onDelete={handleBulkDelete}
        onMove={handleBulkMove}
        onSetPriority={handleBulkPriority}
        onAddTag={handleBulkAddTag}
        onClearSelection={clearSelection}
      />

      {openTodoId && (
        <TaskDetailPanel todoId={openTodoId} onClose={() => setOpenTodoId(null)} />
      )}
    </div>
  )
}
