/**
 * BulkActionBar.tsx — Floating action bar for multi-select mode in list detail
 * Purpose: Complete/delete/move/set-priority/add-tag for the current selection.
 * Inputs: selectedCount, lists (for move target), tags (for tag target), callbacks.
 * Outputs: Sticky bottom bar with action buttons; confirms destructive delete.
 * Constraints: <200 lines; renders null when selectedCount is 0.
 * SPORT: D2-S7 bulk actions UX.
 */
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import type { NpList, NpTag, Priority } from '@/lib/graphql'

interface BulkActionBarProps {
  selectedCount: number
  lists: NpList[]
  tags: NpTag[]
  currentListId?: string
  onComplete: () => void | Promise<void>
  onDelete: () => void | Promise<void>
  onMove: (listId: string) => void | Promise<void>
  onSetPriority: (priority: Priority) => void | Promise<void>
  onAddTag: (tagId: string) => void | Promise<void>
  onClearSelection: () => void
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export function BulkActionBar({
  selectedCount, lists, tags, currentListId,
  onComplete, onDelete, onMove, onSetPriority, onAddTag, onClearSelection,
}: BulkActionBarProps) {
  const t = useT('tasks')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [showPriority, setShowPriority] = useState(false)
  const [showTag, setShowTag] = useState(false)

  if (selectedCount === 0) return null

  async function handleDelete() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    setConfirmingDelete(false)
    await onDelete()
  }

  return (
    <div
      className="fixed inset-x-0 bottom-16 lg:bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-lg"
      role="toolbar"
      aria-label={t('bulk.selected').replace('{{count}}', String(selectedCount))}
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
        {t('bulk.selected').replace('{{count}}', String(selectedCount))}
      </span>

      <button
        type="button"
        onClick={() => onComplete()}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {t('bulk.complete')}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowPriority((v) => !v); setShowMove(false); setShowTag(false) }}
          aria-expanded={showPriority}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t('bulk.priority')}
        </button>
        {showPriority && (
          <div className="absolute bottom-full mb-1 left-0 w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setShowPriority(false); onSetPriority(p) }}
                className="w-full text-left px-3 py-1.5 text-sm capitalize text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t(`createTask.priority${p.charAt(0).toUpperCase()}${p.slice(1)}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {lists.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowMove((v) => !v); setShowPriority(false); setShowTag(false) }}
            aria-expanded={showMove}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('bulk.move')}
          </button>
          {showMove && (
            <div className="absolute bottom-full mb-1 left-0 w-44 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
              {lists.filter((l) => l.id !== currentListId).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setShowMove(false); onMove(l.id) }}
                  className="w-full text-left truncate px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {l.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowTag((v) => !v); setShowPriority(false); setShowMove(false) }}
            aria-expanded={showTag}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('bulk.addTag')}
          </button>
          {showTag && (
            <div className="absolute bottom-full mb-1 left-0 w-40 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => { setShowTag(false); onAddTag(tag.id) }}
                  className="w-full flex items-center gap-2 truncate px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} aria-hidden="true" />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleDelete}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          confirmingDelete
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        }`}
      >
        {confirmingDelete ? t('bulk.deleteConfirm').split('?')[0] + '?' : t('bulk.delete')}
      </button>

      <button
        type="button"
        onClick={onClearSelection}
        className="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
      >
        {t('bulk.clearSelection')}
      </button>
    </div>
  )
}
