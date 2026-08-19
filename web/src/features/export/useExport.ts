/**
 * Purpose: Hook providing export/import for ɳTask tasks. Desktop (Tauri) uses
 *          native FS IPC commands with a save/open dialog; browser uses a
 *          Blob download + hidden file input so the same feature works
 *          without the Tauri runtime.
 * Inputs:  tasks — array of TaskDto from the caller (task list).
 * Outputs: { exportCSV, exportJSON, importJSON } — async action functions.
 *          importJSON returns parsed TaskDto[] for caller preview + confirm.
 * Constraints: Tauri IPC calls guarded by isTauri(); browser path uses only
 *              standard Blob/File APIs (no extra dependency). TaskDto shape
 *              must match Rust commands.rs TaskDto struct (camelCase, same fields).
 *              GAP → Epic B: TaskDto must align with Epic B shared domain types.
 * SPORT: F02-COMMAND-INVENTORY — export_tasks_csv, export_tasks_json, import_tasks_json (E-S2-T3).
 */

import { useCallback } from 'react';
import { isTauri, invoke } from '../../lib/tauri';

/** Minimal task shape for export — aligns with Rust TaskDto. */
export interface TaskDto {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  listId?: string | null;
  createdAt: string;
}

export interface UseExportReturn {
  /** Export tasks as CSV. Native save dialog on desktop; Blob download in browser. */
  exportCSV: (tasks: TaskDto[]) => Promise<void>;
  /** Export tasks as JSON. Native save dialog on desktop; Blob download in browser. */
  exportJSON: (tasks: TaskDto[]) => Promise<void>;
  /**
   * Import tasks from a JSON file. Native open dialog on desktop; hidden
   * `<input type="file">` picker in browser.
   * Returns parsed tasks for preview; caller must confirm before writing to backend.
   * Returns [] if the user cancels or the file is invalid.
   */
  importJSON: () => Promise<TaskDto[]>;
}

/** Escape a CSV field per RFC 4180 (wrap in quotes, double any embedded quotes). */
function csvField(value: string | null | undefined): string {
  const raw = value ?? '';
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function tasksToCsv(tasks: TaskDto[]): string {
  const header = ['id', 'title', 'status', 'priority', 'dueDate', 'listId', 'createdAt'];
  const rows = tasks.map((t) => header.map((key) => csvField(String(t[key as keyof TaskDto] ?? ''))).join(','));
  return [header.join(','), ...rows].join('\n');
}

/** Trigger a browser download for the given text content. */
function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Open a hidden file input and resolve with the selected file's text content (or null on cancel). */
function pickFileText(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

export function useExport(): UseExportReturn {
  const exportCSV = useCallback(async (tasks: TaskDto[]): Promise<void> => {
    if (!isTauri()) {
      downloadBlob(tasksToCsv(tasks), 'text/csv;charset=utf-8', 'ntask-export.csv');
      return;
    }
    await invoke<void>('export_tasks_csv', { tasks });
  }, []);

  const exportJSON = useCallback(async (tasks: TaskDto[]): Promise<void> => {
    if (!isTauri()) {
      downloadBlob(JSON.stringify(tasks, null, 2), 'application/json', 'ntask-export.json');
      return;
    }
    await invoke<void>('export_tasks_json', { tasks });
  }, []);

  const importJSON = useCallback(async (): Promise<TaskDto[]> => {
    if (!isTauri()) {
      const text = await pickFileText('application/json,.json');
      if (!text) return [];
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? (parsed as TaskDto[]) : [];
      } catch {
        return [];
      }
    }
    const result = await invoke<TaskDto[]>('import_tasks_json', {});
    return result._tag === 'Ok' ? result.value : [];
  }, []);

  return { exportCSV, exportJSON, importJSON };
}
