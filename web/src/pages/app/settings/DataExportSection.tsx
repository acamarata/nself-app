/**
 * DataExportSection.tsx — Settings → Account → data export
 * Purpose: Two export paths — (1) server-side GDPR export (async job + email
 *          link, rate-limited) and (2) instant local JSON/CSV export+import of
 *          the user's tasks (browser Blob download / file picker, ExportPanel).
 *          Extracted from AccountTab.tsx to keep both files under the 300-line cap.
 * Inputs:  None — loads its own todos for the local export panel.
 * Outputs: Two stacked cards: server export button, local ExportPanel.
 * Constraints: <150 lines.
 * SPORT: J-S1-T2 (server export) + browser export/import un-gate (D2-S7).
 */
import { useEffect, useState } from 'react'
import { useDataExport } from '@/hooks/useDataExport'
import { useT } from '@/lib/i18n'
import { getAllTodos } from '@/lib/graphql'
import { ExportPanel } from '@/features/export/ExportPanel'
import type { TaskDto } from '@/features/export/useExport'

function toTaskDto(todo: Awaited<ReturnType<typeof getAllTodos>>[number]): TaskDto {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.completed ? 'completed' : 'active',
    priority: todo.priority,
    dueDate: todo.due_date,
    listId: todo.list_id,
    createdAt: todo.created_at,
  }
}

export function DataExportSection() {
  const t = useT('tasks')
  const { requestExport, loading, error } = useDataExport()
  const [tasks, setTasks] = useState<TaskDto[]>([])

  useEffect(() => {
    let cancelled = false
    getAllTodos().then((result) => {
      if (!cancelled) setTasks(result.map(toTaskDto))
    })
    return () => { cancelled = true }
  }, [])

  async function handleExport() {
    const url = await requestExport()
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.dataExport.title')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.dataExport.description')}</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="ml-4 shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? t('states.loading') : t('settings.dataExport.button')}
          </button>
        </div>
        {error === 'rate_limited' && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{t('settings.dataExport.rateLimited')}</p>
        )}
        {error && error !== 'rate_limited' && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <ExportPanel tasks={tasks} />
    </div>
  )
}
