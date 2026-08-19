/**
 * RecurrenceSelector.tsx — RRULE-style recurrence picker for a todo
 * Purpose: Allow user to set/edit/remove a recurring rule.
 * Inputs: todoId, existing rule (NpRecurringRule | null), onChange callback
 * Outputs: Recurrence config UI; calls onCreate/onUpdate/onDelete.
 * Constraints: frequency only (no days_of_week UI in v1), <300 lines.
 * SPORT: D2-S2-T3
 */
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import {
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
} from '@/lib/graphql'
import type { NpRecurringRule } from '@/lib/graphql'

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
type FrequencyOption = 'none' | Frequency

interface RecurrenceSelectorProps {
  todoId: string
  rule: NpRecurringRule | null
  onChange: (rule: NpRecurringRule | null) => void
}

const FREQUENCY_LABELS: Record<FrequencyOption, string> = {
  none: 'recurrence.none',
  daily: 'recurrence.daily',
  weekly: 'recurrence.weekly',
  monthly: 'recurrence.monthly',
  yearly: 'recurrence.yearly',
}

function buildSummary(rule: NpRecurringRule, t: (key: string) => string): string {
  const freqLabel = t(FREQUENCY_LABELS[rule.frequency as FrequencyOption] ?? 'recurrence.none')
  if (rule.interval_count === 1) return freqLabel
  const unit = rule.frequency === 'daily' ? 'days'
    : rule.frequency === 'weekly' ? 'weeks'
    : rule.frequency === 'monthly' ? 'months'
    : 'years'
  return t('recurrence.interval')
    .replace('{{n}}', String(rule.interval_count))
    .replace('{{unit}}', unit)
}

export function RecurrenceSelector({ todoId, rule, onChange }: RecurrenceSelectorProps) {
  const t = useT('tasks')
  const [open, setOpen] = useState(false)
  const [frequency, setFrequency] = useState<FrequencyOption>(
    (rule?.frequency as FrequencyOption) ?? 'none'
  )
  const [interval, setInterval] = useState(rule?.interval_count ?? 1)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    if (frequency === 'none') {
      if (rule) {
        await deleteRecurringRule(rule.id)
        onChange(null)
      }
      setOpen(false)
      setSaving(false)
      return
    }

    if (rule) {
      const updated = await updateRecurringRule(rule.id, {
        frequency,
        interval_count: interval,
      })
      if (updated) onChange(updated)
    } else {
      const created = await createRecurringRule({
        todo_id: todoId,
        frequency,
        interval_count: interval,
      })
      if (created) onChange(created)
    }

    setOpen(false)
    setSaving(false)
  }

  const summary = rule ? buildSummary(rule, t) : t('recurrence.none')

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('recurrence.title')}
        className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
          <path d="M2 8a6 6 0 1 1 12 0M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{summary}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-4 space-y-4">
          <div>
            <label
              htmlFor="recurrence-freq"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              {t('recurrence.title')}
            </label>
            <select
              id="recurrence-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FrequencyOption)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              {(Object.keys(FREQUENCY_LABELS) as FrequencyOption[]).map((freq) => (
                <option key={freq} value={freq}>
                  {t(FREQUENCY_LABELS[freq])}
                </option>
              ))}
            </select>
          </div>

          {frequency !== 'none' && (
            <div>
              <label
                htmlFor="recurrence-interval"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                {t('recurrence.every')}
              </label>
              <input
                id="recurrence-interval"
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, Math.min(99, Number(e.target.value))))}
                className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {saving ? '...' : t('recurrence.save')}
            </button>
            {rule && frequency !== 'none' && (
              <button
                type="button"
                onClick={async () => {
                  setSaving(true)
                  await deleteRecurringRule(rule.id)
                  onChange(null)
                  setFrequency('none')
                  setOpen(false)
                  setSaving(false)
                }}
                disabled={saving}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                {t('recurrence.remove')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('recurrence.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
