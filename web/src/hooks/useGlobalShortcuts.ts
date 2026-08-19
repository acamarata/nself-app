/**
 * Purpose: Listen for global keyboard shortcut events emitted by the Tauri
 *          runtime and map them to app actions. Guards safely in browser.
 * Inputs:  Tauri event 'global-shortcut://quick-add' emitted from lib.rs.
 * Outputs: Side effect — calls onQuickAdd callback when shortcut fires.
 * Constraints: Guard with isTauri(). Shortcuts are registered in Rust lib.rs;
 *              this hook only listens for the resulting event on the frontend.
 * Shortcuts (registered in Rust):
 *   CmdOrCtrl+Shift+N → emit 'global-shortcut://quick-add'
 *   CmdOrCtrl+Shift+T → handled fully in Rust (show/hide window)
 * SPORT: F02-COMMAND-INVENTORY — global-shortcut event names (E-S2-T5).
 */

import { useEffect } from 'react';
import { isTauri } from '../lib/tauri';

async function listenTauri(
  event: string,
  handler: () => void,
): Promise<(() => void) | null> {
  if (!isTauri()) return null;
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen(event, handler);
  return unlisten;
}

export interface UseGlobalShortcutsOptions {
  /** Called when Cmd/Ctrl+Shift+N fires from the global shortcut. */
  onQuickAdd?: () => void;
}

/**
 * Register handlers for global keyboard shortcut events.
 * Mount once in the app root or layout component.
 */
export function useGlobalShortcuts({ onQuickAdd }: UseGlobalShortcutsOptions): void {
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;

    listenTauri('global-shortcut://quick-add', () => {
      onQuickAdd?.();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [onQuickAdd]);
}
