/**
 * ShortcutReferenceModal.tsx — Keyboard shortcut reference overlay
 * Purpose: Show a table of all in-app keyboard shortcuts.
 *          Triggered by '?' key via useKeyboardShortcuts.
 * Inputs:  onClose: () => void
 * Outputs: Dialog overlay with shortcut table.
 * Constraints: WCAG dialog. Close on Escape or overlay click. ≤100 lines.
 * SPORT: D2-S7-T2
 */
import { useEffect } from 'react'
import { useT } from '@/lib/i18n'

interface Props {
  onClose: () => void
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const CMD = IS_MAC ? '⌘' : 'Ctrl'

const SHORTCUTS = [
  { actionKey: 'shortcuts.newTask', key: 'C' },
  { actionKey: 'shortcuts.newList', key: 'L' },
  { actionKey: 'shortcuts.search', key: `${CMD} K` },
  { actionKey: 'shortcuts.showShortcuts', key: '?' },
] as const

export function ShortcutReferenceModal({ onClose }: Props) {
  const t = useT('tasks')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        role="dialog"
        aria-label={t('shortcuts.title')}
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('shortcuts.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('shortcuts.close')}
            className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <th className="pb-2 font-medium">{t('shortcuts.action')}</th>
              <th className="pb-2 font-medium text-right">{t('shortcuts.shortcut')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {SHORTCUTS.map(({ actionKey, key }) => (
              <tr key={actionKey}>
                <td className="py-2.5 text-gray-700 dark:text-gray-300">{t(actionKey)}</td>
                <td className="py-2.5 text-right">
                  <kbd className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {key}
                  </kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
