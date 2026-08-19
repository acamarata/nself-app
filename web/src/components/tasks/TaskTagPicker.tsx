/**
 * TaskTagPicker.tsx — Tag chip picker for a single task (TaskDetailPanel)
 * Purpose: Toggle tags on/off for a todo; inline "create new tag" flow.
 *          Port of apps/mobile/src/components/TagPicker.tsx to web/Tailwind.
 * Inputs: todoId string.
 * Outputs: Chip row (add/remove tag), inline create-tag form with color swatches.
 * Constraints: WCAG a11y (checkbox role + aria-checked on chips); i18n via useT; <200 lines.
 * SPORT: D2-S7 tags UX (web port of P5-C-mobile TagPicker).
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { getTags, createTag, addTodoTag, removeTodoTag } from '@/lib/graphql'
import type { NpTag } from '@/lib/graphql'

const TAG_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

interface TaskTagPickerProps {
  todoId: string
  todoTagIds: string[]
  onTagsChanged: (tagIds: string[]) => void
}

export function TaskTagPicker({ todoId, todoTagIds, onTagsChanged }: TaskTagPickerProps) {
  const t = useT('tasks')
  const [allTags, setAllTags] = useState<NpTag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0] ?? '#6366f1')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    getTags().then((result) => {
      if (!cancelled) { setAllTags(result); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const activeIds = new Set(todoTagIds)

  async function handleToggle(tag: NpTag) {
    setWorking(true)
    if (activeIds.has(tag.id)) {
      await removeTodoTag(todoId, tag.id)
      onTagsChanged(todoTagIds.filter((id) => id !== tag.id))
    } else {
      await addTodoTag(todoId, tag.id)
      onTagsChanged([...todoTagIds, tag.id])
    }
    setWorking(false)
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setWorking(true)
    const created = await createTag({ name, color: selectedColor })
    if (created) {
      setAllTags((prev) => [...prev, created])
      await addTodoTag(todoId, created.id)
      onTagsChanged([...todoTagIds, created.id])
    }
    setNewName('')
    setShowCreate(false)
    setWorking(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('tags.title')}</span>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-xs font-medium text-brand-primary hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {showCreate ? t('createTask.cancel') : t('tags.add')}
        </button>
      </div>

      {loading && <p className="text-xs text-gray-400 animate-pulse">{t('states.loading')}</p>}

      {!loading && allTags.length === 0 && !showCreate && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('tags.empty')}</p>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('tags.title')}>
          {allTags.map((tag) => {
            const active = activeIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggle(tag)}
                disabled={working}
                role="checkbox"
                aria-checked={active}
                aria-label={`${t('tags.title')}: ${tag.name}`}
                className="rounded-full px-2.5 py-1 text-xs font-semibold border-[1.5px] transition-colors disabled:opacity-50"
                style={{
                  borderColor: tag.color,
                  backgroundColor: active ? tag.color : 'transparent',
                  color: active ? '#fff' : tag.color,
                }}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('tags.placeholder')}
            maxLength={50}
            autoFocus
            aria-label={t('tags.placeholder')}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          <div className="flex gap-1.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={selectedColor === c}
                className="h-6 w-6 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: selectedColor === c ? '#111827' : 'transparent',
                  transform: selectedColor === c ? 'scale(1.15)' : undefined,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={working || !newName.trim()}
            className="w-full rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            {t('tags.add')}
          </button>
        </div>
      )}
    </div>
  )
}
