/**
 * coverage-hooks.test.ts — Coverage tests for near-0% hooks.
 *
 * Purpose: Exercise usePageMeta, useDeepLink, useSyncStatus,
 *          useGlobalShortcuts, and useTrayStatus with effect/cleanup and
 *          Tauri-guard branch coverage.
 * SPORT: D-S9-T1 (page meta) · deep-link routing · sync status derivation ·
 *        F02-COMMAND-INVENTORY (global-shortcut, set_tray_status).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockIsTauri = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@/lib/tauri', () => ({
  isTauri: (...args: unknown[]) => mockIsTauri(...args),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockListen = vi.fn()
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}))

// ── usePageMeta ───────────────────────────────────────────────────────────────

describe('usePageMeta', () => {
  afterEach(() => {
    document.title = ''
    document.querySelectorAll('meta').forEach((el) => el.remove())
  })

  it('sets document.title with the ɳTask suffix', async () => {
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'My Page' }))
    expect(document.title).toBe('My Page — ɳTask')
  })

  it('creates a description meta tag when none exists', async () => {
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'Page', description: 'Custom description' }))
    const meta = document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toBe('Custom description')
  })

  it('uses default description when none provided', async () => {
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'Page' }))
    const meta = document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toMatch(/free, open-source task manager/)
  })

  it('reuses an existing description meta tag rather than duplicating it', async () => {
    document.querySelectorAll('meta[name="description"]').forEach((el) => el.remove())
    const existing = document.createElement('meta')
    existing.setAttribute('name', 'description')
    existing.setAttribute('content', 'old')
    document.head.appendChild(existing)

    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'Page', description: 'new' }))

    const metas = document.querySelectorAll('meta[name="description"]')
    expect(metas).toHaveLength(1)
    expect(metas[0]?.getAttribute('content')).toBe('new')
  })

  it('sets og:title and og:image when ogImage is provided', async () => {
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'Page', ogImage: 'https://example.com/img.png' }))
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Page')
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.com/img.png',
    )
  })

  it('does not create og:image meta when ogImage is omitted', async () => {
    document.querySelectorAll('meta[property="og:image"]').forEach((el) => el.remove())
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    renderHook(() => usePageMeta({ title: 'Page' }))
    expect(document.querySelector('meta[property="og:image"]')).toBeNull()
  })

  it('restores previous title and meta content on unmount', async () => {
    document.title = 'Original Title'
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    const { unmount } = renderHook(() => usePageMeta({ title: 'New Page', description: 'new desc' }))
    expect(document.title).toBe('New Page — ɳTask')
    unmount()
    expect(document.title).toBe('Original Title')
  })

  it('restores previous og:image on unmount when it existed before', async () => {
    const existing = document.createElement('meta')
    existing.setAttribute('property', 'og:image')
    existing.setAttribute('content', 'https://example.com/old.png')
    document.head.appendChild(existing)

    const { usePageMeta } = await import('@/hooks/usePageMeta')
    const { unmount } = renderHook(() =>
      usePageMeta({ title: 'Page', ogImage: 'https://example.com/new.png' }),
    )
    unmount()
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.com/old.png',
    )
  })

  it('re-runs the effect when title changes', async () => {
    const { usePageMeta } = await import('@/hooks/usePageMeta')
    const { rerender } = renderHook(({ title }) => usePageMeta({ title }), {
      initialProps: { title: 'First' },
    })
    expect(document.title).toBe('First — ɳTask')
    rerender({ title: 'Second' })
    expect(document.title).toBe('Second — ɳTask')
  })
})

// ── useDeepLink ───────────────────────────────────────────────────────────────

describe('useDeepLink', () => {
  beforeEach(() => {
    mockIsTauri.mockReset()
    mockListen.mockReset()
    mockNavigate.mockReset()
  })

  it('does not navigate when not in Tauri context', async () => {
    mockIsTauri.mockReturnValue(false)
    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).not.toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('registers a deep-link listener and navigates to home for empty host', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())

    await waitFor(() => expect(mockListen).toHaveBeenCalledWith('deep-link', expect.any(Function)))

    act(() => {
      capturedHandler?.({ payload: 'ntask://' })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: false })
  })

  it('navigates to /settings for ntask://settings', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())

    act(() => capturedHandler?.({ payload: 'ntask://settings' }))
    expect(mockNavigate).toHaveBeenCalledWith('/settings', { replace: false })
  })

  it('navigates to /task/<id> for ntask://task/<id>', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())

    act(() => capturedHandler?.({ payload: 'ntask://task/abc-123' }))
    expect(mockNavigate).toHaveBeenCalledWith('/task/abc-123', { replace: false })
  })

  it('navigates to /list for ntask://list with no id', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())

    act(() => capturedHandler?.({ payload: 'ntask://list' }))
    expect(mockNavigate).toHaveBeenCalledWith('/list', { replace: false })
  })

  it('navigates to / for an unknown protocol', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())

    act(() => capturedHandler?.({ payload: 'https://evil.example.com' }))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: false })
  })

  it('navigates to / for a malformed URL', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: ((e: { payload: string }) => void) | undefined
    mockListen.mockImplementation((_event: string, handler: (e: { payload: string }) => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())

    act(() => capturedHandler?.({ payload: 'not a url at all' }))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: false })
  })

  it('calls the unlisten function on unmount', async () => {
    mockIsTauri.mockReturnValue(true)
    const unlistenFn = vi.fn()
    mockListen.mockResolvedValue(unlistenFn)

    const { useDeepLink } = await import('@/hooks/useDeepLink')
    const { unmount } = renderHook(() => useDeepLink())
    await waitFor(() => expect(mockListen).toHaveBeenCalled())
    // allow the listenTauri promise chain to resolve and assign `unlisten`
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    expect(unlistenFn).toHaveBeenCalled()
  })
})

// ── useSyncStatus ─────────────────────────────────────────────────────────────

describe('useSyncStatus', () => {
  let onLineSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get')
  })

  afterEach(() => {
    vi.useRealTimers()
    onLineSpy.mockRestore()
  })

  it('initializes to "online" when navigator.onLine is true', async () => {
    onLineSpy.mockReturnValue(true)
    const { useSyncStatus } = await import('@/hooks/useSyncStatus')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current.status).toBe('online')
    expect(result.current.lastSyncedAt).toBeNull()
  })

  it('initializes to "offline" when navigator.onLine is false', async () => {
    onLineSpy.mockReturnValue(false)
    const { useSyncStatus } = await import('@/hooks/useSyncStatus')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current.status).toBe('offline')
  })

  it('transitions offline -> syncing -> online on the online event', async () => {
    onLineSpy.mockReturnValue(false)
    const { useSyncStatus } = await import('@/hooks/useSyncStatus')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current.status).toBe('offline')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.status).toBe('syncing')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.status).toBe('online')
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date)
  })

  it('transitions to "offline" on the offline event', async () => {
    onLineSpy.mockReturnValue(true)
    const { useSyncStatus } = await import('@/hooks/useSyncStatus')
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.status).toBe('offline')
  })

  it('removes event listeners on unmount', async () => {
    onLineSpy.mockReturnValue(true)
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { useSyncStatus } = await import('@/hooks/useSyncStatus')
    const { unmount } = renderHook(() => useSyncStatus())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    removeSpy.mockRestore()
  })
})

// ── useGlobalShortcuts ────────────────────────────────────────────────────────

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    mockIsTauri.mockReset()
    mockListen.mockReset()
  })

  it('does not register a listener when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false)
    const onQuickAdd = vi.fn()
    const { useGlobalShortcuts } = await import('@/hooks/useGlobalShortcuts')
    renderHook(() => useGlobalShortcuts({ onQuickAdd }))
    await waitFor(() => expect(mockListen).not.toHaveBeenCalled())
  })

  it('registers a listener and invokes onQuickAdd when the shortcut fires', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: (() => void) | undefined
    mockListen.mockImplementation((_event: string, handler: () => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })
    const onQuickAdd = vi.fn()

    const { useGlobalShortcuts } = await import('@/hooks/useGlobalShortcuts')
    renderHook(() => useGlobalShortcuts({ onQuickAdd }))

    await waitFor(() =>
      expect(mockListen).toHaveBeenCalledWith('global-shortcut://quick-add', expect.any(Function)),
    )
    act(() => capturedHandler?.())
    expect(onQuickAdd).toHaveBeenCalled()
  })

  it('does not throw when onQuickAdd is undefined and the shortcut fires', async () => {
    mockIsTauri.mockReturnValue(true)
    let capturedHandler: (() => void) | undefined
    mockListen.mockImplementation((_event: string, handler: () => void) => {
      capturedHandler = handler
      return Promise.resolve(vi.fn())
    })

    const { useGlobalShortcuts } = await import('@/hooks/useGlobalShortcuts')
    renderHook(() => useGlobalShortcuts({}))
    await waitFor(() => expect(mockListen).toHaveBeenCalled())
    expect(() => act(() => capturedHandler?.())).not.toThrow()
  })

  it('calls unlisten on unmount', async () => {
    mockIsTauri.mockReturnValue(true)
    const unlistenFn = vi.fn()
    mockListen.mockResolvedValue(unlistenFn)

    const { useGlobalShortcuts } = await import('@/hooks/useGlobalShortcuts')
    const { unmount } = renderHook(() => useGlobalShortcuts({}))
    await waitFor(() => expect(mockListen).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    expect(unlistenFn).toHaveBeenCalled()
  })
})

// ── useTrayStatus ─────────────────────────────────────────────────────────────

describe('useTrayStatus', () => {
  beforeEach(() => {
    mockIsTauri.mockReset()
    mockInvoke.mockReset()
  })

  it('does not call invoke when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false)
    const { useTrayStatus } = await import('@/hooks/useTrayStatus')
    renderHook(() => useTrayStatus('connected'))
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('calls set_tray_status with the current state when in Tauri', async () => {
    mockIsTauri.mockReturnValue(true)
    mockInvoke.mockResolvedValue(undefined)
    const { useTrayStatus } = await import('@/hooks/useTrayStatus')
    renderHook(() => useTrayStatus('syncing'))
    expect(mockInvoke).toHaveBeenCalledWith('set_tray_status', { state: 'syncing' })
  })

  it('re-invokes when trayState changes', async () => {
    mockIsTauri.mockReturnValue(true)
    mockInvoke.mockResolvedValue(undefined)
    const { useTrayStatus } = await import('@/hooks/useTrayStatus')
    const { rerender } = renderHook(({ state }) => useTrayStatus(state), {
      initialProps: { state: 'connected' as const },
    })
    rerender({ state: 'offline' as const })
    expect(mockInvoke).toHaveBeenCalledWith('set_tray_status', { state: 'connected' })
    expect(mockInvoke).toHaveBeenCalledWith('set_tray_status', { state: 'offline' })
  })

  it('logs a warning when invoke rejects', async () => {
    mockIsTauri.mockReturnValue(true)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvoke.mockRejectedValue(new Error('ipc failed'))

    const { useTrayStatus } = await import('@/hooks/useTrayStatus')
    renderHook(() => useTrayStatus('offline'))

    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
    expect(warnSpy).toHaveBeenCalledWith('[useTrayStatus] set_tray_status failed:', expect.any(Error))
    warnSpy.mockRestore()
  })
})
