/**
 * useFocusTrap.test.tsx
 *
 * Purpose:    Unit tests for useFocusTrap: initial focus-in, Tab/Shift+Tab
 *             cycling within the container, Escape-to-close, and focus
 *             restoration to the launching element on unmount.
 * Constraints: vitest + @testing-library/react, jsdom environment.
 * SPORT:      N-S1-T1 (web WCAG 2.1 AA gate)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from '../useFocusTrap'

function TestDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, onClose)
  return (
    <div>
      <button>outside</button>
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
        <button>first</button>
        <button>second</button>
        <button>last</button>
      </div>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the container on mount', () => {
    render(<TestDialog onClose={vi.fn()} />)
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('cycles focus forward from the last element to the first on Tab', () => {
    render(<TestDialog onClose={vi.fn()} />)
    screen.getByText('last').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('cycles focus backward from the first element to the last on Shift+Tab', () => {
    render(<TestDialog onClose={vi.fn()} />)
    screen.getByText('first').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('last')).toHaveFocus()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<TestDialog onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('restores focus to the previously focused element on unmount', () => {
    const launcher = document.createElement('button')
    launcher.textContent = 'launcher'
    document.body.appendChild(launcher)
    launcher.focus()
    expect(launcher).toHaveFocus()

    const { unmount } = render(<TestDialog onClose={vi.fn()} />)
    expect(screen.getByText('first')).toHaveFocus()

    unmount()
    expect(launcher).toHaveFocus()

    launcher.remove()
  })

  it('does not trap focus when active is false', () => {
    function InactiveDialog() {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(ref, vi.fn(), { active: false })
      return (
        <div ref={ref} role="dialog">
          <button>first</button>
        </div>
      )
    }
    render(<InactiveDialog />)
    expect(screen.getByText('first')).not.toHaveFocus()
  })
})
