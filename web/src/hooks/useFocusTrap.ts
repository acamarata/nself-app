/**
 * useFocusTrap.ts — reusable modal/dialog focus-trap hook
 *
 * Purpose:    Shared WCAG 2.1 AA focus-management behavior for modal dialogs
 *             and slide-in panels: moves focus into the container on mount,
 *             cycles Tab/Shift+Tab within its focusable descendants so Tab
 *             can never escape to the page behind it, closes on Escape, and
 *             restores focus to whatever element was focused before the
 *             dialog opened once it closes/unmounts.
 * Inputs:     containerRef — ref to the dialog's outer element (should carry
 *             role="dialog"/aria-modal="true" and tabIndex={-1} as a focus
 *             fallback). onClose — invoked on Escape. options.active — set
 *             false to skip trapping without unmounting (default true).
 * Outputs:    void; side effect only (attaches a document keydown listener
 *             for the lifetime of the effect).
 * Constraints: No external deps. Reused by NewListModal, ShareListDialog,
 *             and TaskDetailPanel instead of each re-implementing focus
 *             management — see engineering-standard.md DRY rule.
 */
import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface UseFocusTrapOptions {
  /** Set false to temporarily disable the trap without unmounting. Default true. */
  active?: boolean
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  { active = true }: UseFocusTrapOptions = {},
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    function getFocusable(): HTMLElement[] {
      if (!container) return []
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    }

    ;(getFocusable()[0] ?? container)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const items = getFocusable()
      if (items.length === 0) {
        e.preventDefault()
        container?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [containerRef, onClose, active])
}
