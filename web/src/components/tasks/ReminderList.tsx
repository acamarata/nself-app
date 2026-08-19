/**
 * ReminderList.tsx — Reminders section for TaskDetailPanel
 * Purpose: List/add/remove np_reminders for a todo, with quick presets
 *          (at due time, 10m/1h/1d before) plus a custom date+time picker.
 * Inputs: todoId string, dueDate (ISO | null) — presets are relative to it.
 * Outputs: Reminder rows with remove button; add-reminder control.
 * Constraints: <250 lines; presets disabled when no due date is set.
 * SPORT: D2-S7 reminders UX.
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { getReminders, createReminder, deleteReminder } from '@/lib/graphql'
import type { NpReminder } from '@/lib/graphql'

interface ReminderListProps {
  todoId: string
  dueDate: string | null
}

type PresetKey = 'atDue' | '10m' | '1h' | '1d'

const PRESET_OFFSETS_MS: Record<Exclude<PresetKey, 'atDue'>, number> = {
  '10m': 10 * 60_000,
  '1h': 60 * 60_000,
  '1d': 24 * 60 * 60_000,
}

function formatRemindAt(iso: string, locale: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function ReminderList({ todoId, dueDate }: ReminderListProps) {
  const t = useT('tasks')
  const locale = document.documentElement.lang || 'en'
  const [reminders, setReminders] = useState<NpReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [customAt, setCustomAt] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!expanded) return
    async function load() {
      setLoading(true)
      const result = await getReminders(todoId)
      if (!cancelled) { setReminders(result); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [todoId, expanded])

  async function addReminder(remindAt: string) {
    setWorking(true)
    const created = await createReminder({ todo_id: todoId, remind_at: remindAt })
    if (created) setReminders((prev) => [...prev, created].sort((a, b) => a.remind_at.localeCompare(b.remind_at)))
    setWorking(false)
  }

  async function handlePreset(preset: PresetKey) {
    if (!dueDate) return
    const dueMs = new Date(dueDate).getTime()
    const remindMs = preset === 'atDue' ? dueMs : dueMs - PRESET_OFFSETS_MS[preset]
    await addReminder(new Date(remindMs).toISOString())
  }

  async function handleCustomAdd() {
    if (!customAt) return
    const iso = new Date(customAt).toISOString()
    await addReminder(iso)
    setCustomAt('')
  }

  async function handleRemove(id: string) {
    const previous = reminders
    setReminders((prev) => prev.filter((r) => r.id !== id))
    const ok = await deleteReminder(id)
    if (!ok) setReminders(previous)
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-expanded={expanded}
      >
        <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t('reminders.title')}</span>
        {reminders.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{reminders.length}</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-sm text-gray-400 animate-pulse">{t('states.loading')}</p>}

          {!loading && reminders.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">{t('reminders.empty')}</p>
          )}

          {!loading && reminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {formatRemindAt(r.remind_at, locale)}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(r.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`${t('reminders.remove')}: ${formatRemindAt(r.remind_at, locale)}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5">
            {(['atDue', '10m', '1h', '1d'] as PresetKey[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                disabled={working || !dueDate}
                className="rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                {t(`reminders.preset.${preset}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={customAt}
              onChange={(e) => setCustomAt(e.target.value)}
              aria-label={t('reminders.custom')}
              className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <button
              type="button"
              onClick={handleCustomAdd}
              disabled={working || !customAt}
              aria-label={t('reminders.add')}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
