/**
 * NotesEditor.tsx — Markdown-lite notes editor with preview toggle
 * Purpose: Replaces the plain notes textarea in TaskDetailPanel with an
 *          edit/preview toggle so users can write lightweight markdown notes.
 * Inputs: value (current notes string), onSave(next) callback (fires on blur),
 *         disabled (saving state passthrough).
 * Outputs: Textarea in edit mode; sanitized HTML preview in preview mode.
 * Constraints: No heavy editor dependency — uses lib/markdown-lite.ts.
 *              <150 lines.
 * SPORT: D2-S7 notes UX.
 */
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { renderMarkdownLite } from '@/lib/markdown-lite'

interface NotesEditorProps {
  value: string
  onSave: (next: string) => void | Promise<void>
  disabled?: boolean
}

export function NotesEditor({ value, onSave, disabled }: NotesEditorProps) {
  const t = useT('tasks')
  const [draft, setDraft] = useState(value)
  const [previewing, setPreviewing] = useState(false)

  function handleBlur() {
    if (draft !== value) onSave(draft)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('createTask.notes')}</span>
        <button
          type="button"
          onClick={() => setPreviewing((v) => !v)}
          className="text-xs font-medium text-brand-primary hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {previewing ? t('notes.edit') : t('notes.preview')}
        </button>
      </div>

      {previewing ? (
        <div
          className="min-h-[4.5rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 prose-sm max-w-none [&_a]:break-words"
          // Safe: renderMarkdownLite HTML-escapes all input before substitution.
          dangerouslySetInnerHTML={{ __html: draft.trim() ? renderMarkdownLite(draft) : `<p class="italic text-gray-400">${t('taskDetail.notesPlaceholder')}</p>` }}
        />
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          disabled={disabled}
          aria-label={t('createTask.notes')}
          placeholder={t('taskDetail.notesPlaceholder')}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50 font-mono"
        />
      )}
    </div>
  )
}
