/**
 * Purpose: Export / Import panel for ɳTask. Renders Export CSV, Export JSON,
 *          and Import JSON buttons. Works in both the browser (Blob download +
 *          file-input picker, via useExport's isTauri()-branching) and the
 *          Tauri desktop shell (native save/open dialogs). Shows a
 *          confirmation step after import parse.
 * Inputs:  tasks — current task list from caller (task list page or settings).
 *          onImportConfirmed — callback with imported TaskDto[] for backend write.
 * Outputs: JSX panel with three action buttons + import preview.
 * Constraints: Import shows a dry-run count before the caller writes to backend.
 * SPORT: no new entry (UI component).
 */

import { useState } from 'react';
import { useExport } from './useExport';
import type { TaskDto } from './useExport';

interface ExportPanelProps {
  /** Current task list to export. */
  tasks: TaskDto[];
  /** Called with imported tasks after user confirms the import. */
  onImportConfirmed?: (tasks: TaskDto[]) => void;
}

export function ExportPanel({ tasks, onImportConfirmed }: ExportPanelProps): React.JSX.Element {
  const { exportCSV, exportJSON, importJSON } = useExport();
  const [importPreview, setImportPreview] = useState<TaskDto[] | null>(null);
  const [loading, setLoading] = useState<'csv' | 'json' | 'import' | null>(null);

  const handleExportCSV = async () => {
    setLoading('csv');
    try { await exportCSV(tasks); } finally { setLoading(null); }
  };

  const handleExportJSON = async () => {
    setLoading('json');
    try { await exportJSON(tasks); } finally { setLoading(null); }
  };

  const handleImportJSON = async () => {
    setLoading('import');
    try {
      const imported = await importJSON();
      if (imported.length > 0) setImportPreview(imported);
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmImport = () => {
    if (importPreview) {
      onImportConfirmed?.(importPreview);
      setImportPreview(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Import &amp; Export</h3>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportCSV}
          disabled={loading !== null}
          className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground disabled:opacity-50"
        >
          {loading === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
        <button
          onClick={handleExportJSON}
          disabled={loading !== null}
          className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground disabled:opacity-50"
        >
          {loading === 'json' ? 'Exporting…' : 'Export JSON'}
        </button>
        <button
          onClick={handleImportJSON}
          disabled={loading !== null}
          className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground disabled:opacity-50"
        >
          {loading === 'import' ? 'Reading…' : 'Import from JSON'}
        </button>
      </div>

      {importPreview !== null && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Found <strong>{importPreview.length}</strong> task{importPreview.length === 1 ? '' : 's'} to import.
            This will merge them into your current task list.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleConfirmImport}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              Confirm Import
            </button>
            <button
              onClick={() => setImportPreview(null)}
              className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
