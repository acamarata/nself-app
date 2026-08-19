/**
 * useKeyboardShortcuts.ts — In-app web keyboard shortcut dispatcher
 * Purpose: Listen for global keydown events and fire registered callbacks.
 *          Skips events targeting text inputs, textareas, selects, and
 *          contenteditable elements. This is NOT the Tauri global shortcut
 *          hook (see useGlobalShortcuts.ts — that handles CmdOrCtrl+Shift+N).
 * Inputs:  shortcuts: Record<string, () => void>
 *          Keys: single chars ('c','l','?') or modifier combos ('cmd+k','ctrl+k').
 *          Use 'cmd+k' to match either Cmd (mac) or Ctrl (win/linux) + k.
 * Outputs: Side-effect only — mounts and cleans up a keydown listener.
 * Constraints: Mount once in AppShell. ≤80 lines.
 * SPORT: D2-S7-T2
 */
import { useEffect } from 'react'

type ShortcutMap = Record<string, () => void>

/** Returns true when the event's target is an editable field. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Derive a canonical key descriptor from a KeyboardEvent.
 * Modifier combos are expressed as 'cmd+<key>' (meta or ctrl).
 */
function describeEvent(e: KeyboardEvent): string {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    return `cmd+${e.key.toLowerCase()}`
  }
  // bare single char (no modifiers)
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    return e.key
  }
  return ''
}

/**
 * Mount global in-app keyboard shortcuts.
 *
 * @example
 * useKeyboardShortcuts({
 *   'c': () => openCreateTask(),
 *   'cmd+k': () => openCommandPalette(),
 * })
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(e.target)) return

      const key = describeEvent(e)
      if (!key) return

      const handler = shortcuts[key]
      if (handler) {
        e.preventDefault()
        handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
