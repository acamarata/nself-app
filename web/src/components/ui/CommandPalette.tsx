/**
 * CommandPalette.tsx — Cmd+K command palette with task search + commands
 * Purpose: Unified launcher: run app commands or search tasks in one modal.
 *          Commands section shows when query fuzzy-matches a command name.
 *          Task results appear below commands.
 * Inputs:  onClose, onNewTask?, onNewList?
 * Outputs: Full-screen dialog overlay with fuzzy command matching + search.
 * Constraints: WCAG dialog. ≤300 lines.
 * SPORT: D2-S7-T2
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { useT } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { SearchBar } from '@/components/tasks/SearchBar'
import type { NpTaskSummary } from '@/lib/graphql'

interface Command {
  id: string
  labelKey: string
  keywords: string[]
  action: () => void
}

interface Props {
  onClose: () => void
  onNewTask?: () => void
  onNewList?: () => void
}

type ItemType = { kind: 'command'; cmd: Command } | { kind: 'task'; task: NpTaskSummary }

function fuzzyMatch(query: string, keywords: string[]): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return keywords.some((kw) => kw.toLowerCase().includes(q))
}

export function CommandPalette({ onClose, onNewTask, onNewList }: Props) {
  const t = useT('tasks')
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [taskResults, setTaskResults] = useState<NpTaskSummary[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = [
    {
      id: 'new-task',
      labelKey: 'palette.newTask',
      keywords: ['new task', 'add task', 'create task', 'task'],
      action: () => { onClose(); onNewTask?.() },
    },
    {
      id: 'new-list',
      labelKey: 'palette.newList',
      keywords: ['new list', 'add list', 'create list', 'list'],
      action: () => { onClose(); onNewList?.() },
    },
    {
      id: 'view-today',
      labelKey: 'palette.viewToday',
      keywords: ['today', 'due today', 'overdue'],
      action: () => { navigate('/today'); onClose() },
    },
    {
      id: 'view-upcoming',
      labelKey: 'palette.viewUpcoming',
      keywords: ['upcoming', 'next 7 days', 'this week'],
      action: () => { navigate('/upcoming'); onClose() },
    },
    {
      id: 'view-inbox',
      labelKey: 'palette.viewInbox',
      keywords: ['inbox', 'untriaged', 'no list'],
      action: () => { navigate('/inbox'); onClose() },
    },
    {
      id: 'view-calendar',
      labelKey: 'palette.viewCalendar',
      keywords: ['calendar', 'month', 'schedule'],
      action: () => { navigate('/calendar'); onClose() },
    },
    {
      id: 'view-board',
      labelKey: 'palette.viewBoard',
      keywords: ['board', 'kanban', 'columns'],
      action: () => { navigate('/board'); onClose() },
    },
    {
      id: 'view-logbook',
      labelKey: 'palette.viewLogbook',
      keywords: ['logbook', 'completed', 'history', 'done'],
      action: () => { navigate('/logbook'); onClose() },
    },
    {
      id: 'settings',
      labelKey: 'palette.settings',
      keywords: ['settings', 'preferences', 'config', 'set'],
      action: () => { navigate('/settings'); onClose() },
    },
    {
      id: 'toggle-theme',
      labelKey: 'palette.toggleTheme',
      keywords: ['theme', 'dark', 'light', 'toggle', 'appearance'],
      action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose() },
    },
    {
      id: 'sign-out',
      labelKey: 'palette.signOut',
      keywords: ['sign out', 'logout', 'log out'],
      action: async () => { await signOut(); navigate('/login'); onClose() },
    },
  ]

  const matchedCommands = commands.filter((cmd) => fuzzyMatch(query, cmd.keywords))
  const taskItems = taskResults.slice(0, 5)

  const items: ItemType[] = [
    ...matchedCommands.map((cmd): ItemType => ({ kind: 'command', cmd })),
    ...taskItems.map((task): ItemType => ({ kind: 'task', task })),
  ]

  // Reset selection when list changes
  useEffect(() => setSelectedIdx(0), [query, taskResults])

  function activate(item: ItemType) {
    if (item.kind === 'command') {
      void item.cmd.action()
    } else {
      navigate(`/lists/${item.task.list_id}`)
      onClose()
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const item = items[selectedIdx]
        if (item) activate(item)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, selectedIdx]
  )

  const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  const CMD = IS_MAC ? '⌘' : 'Ctrl'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh]"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        role="dialog"
        aria-label={t('palette.label')}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <SearchBar
            onResults={setTaskResults}
            initialQuery={query}
            onQueryChange={setQuery}
          />
        </div>

        {/* Combined list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {matchedCommands.length > 0 && (
            <section aria-label={t('palette.commandsSection')}>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {t('palette.commandsSection')}
              </p>
              {matchedCommands.map((cmd, i) => {
                const globalIdx = i
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    role="option"
                    aria-selected={globalIdx === selectedIdx}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      globalIdx === selectedIdx
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => void cmd.action()}
                  >
                    <svg className="h-4 w-4 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="flex-1">{t(cmd.labelKey)}</span>
                    <kbd className="ml-auto rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400 font-mono hidden sm:block">
                      {CMD} K
                    </kbd>
                  </button>
                )
              })}
            </section>
          )}

          {taskItems.length > 0 && (
            <section aria-label={t('search.tasksSection')}>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {t('search.tasksSection')}
              </p>
              {taskItems.map((task, i) => {
                const globalIdx = matchedCommands.length + i
                return (
                  <button
                    key={task.id}
                    type="button"
                    role="option"
                    aria-selected={globalIdx === selectedIdx}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      globalIdx === selectedIdx
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => { navigate(`/lists/${task.list_id}`); onClose() }}
                  >
                    <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="truncate flex-1">{task.title}</span>
                  </button>
                )
              })}
            </section>
          )}

          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              {t('palette.noResults')}
            </div>
          )}
        </div>

        {/* Hint bar */}
        <div className="flex items-center gap-4 border-t border-gray-100 dark:border-gray-800 px-4 py-2 text-xs text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> {t('palette.hintNavigate')}</span>
          <span><kbd className="font-mono">↵</kbd> {t('palette.hintSelect')}</span>
          <span><kbd className="font-mono">Esc</kbd> {t('palette.hintClose')}</span>
        </div>
      </div>
    </div>
  )
}
