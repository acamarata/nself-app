/**
 * TagFilter.tsx — Tag filter chip row for todo lists
 * Purpose: Show user's tags as clickable filter chips.
 * Inputs: selectedTagIds (string[]), onTagToggle (id: string) => void
 * Outputs: Horizontally scrollable tag chip row.
 * Constraints: Loads own tags, <200 lines.
 * SPORT: D2-S1 tags filter
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { getTags } from '@/lib/graphql'
import type { NpTag } from '@/lib/graphql'

interface TagFilterProps {
  selectedTagIds: string[]
  onTagToggle: (id: string) => void
}

export function TagFilter({ selectedTagIds, onTagToggle }: TagFilterProps) {
  const t = useT('tasks')
  const [tags, setTags] = useState<NpTag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const result = await getTags()
      if (!cancelled) {
        setTags(result)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading || tags.length === 0) return null

  const hasSelected = selectedTagIds.length > 0

  function clearAll() {
    selectedTagIds.forEach((id) => onTagToggle(id))
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1"
      role="group"
      aria-label={t('tags.filter')}
    >
      {hasSelected && (
        <button
          type="button"
          onClick={clearAll}
          className="shrink-0 rounded-full border border-gray-300 dark:border-gray-600 px-2.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Clear tag filters"
        >
          Clear
        </button>
      )}

      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onTagToggle(tag.id)}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? 'Remove' : 'Filter by'} tag: ${tag.name}`}
            className={`
              shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all
              ${isSelected
                ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900 shadow-sm'
                : 'opacity-70 hover:opacity-100 border border-gray-200 dark:border-gray-700'
              }
            `}
            style={{
              backgroundColor: isSelected ? `${tag.color}20` : undefined,
              color: tag.color,
              ringColor: isSelected ? tag.color : undefined,
              borderColor: isSelected ? tag.color : undefined,
            } as React.CSSProperties}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
              aria-hidden="true"
            />
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
