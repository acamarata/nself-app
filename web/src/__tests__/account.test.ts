/**
 * account.test.ts — unit tests for account-management hooks
 *
 * Tests useDeleteAccount and useDataExport in isolation using fetch mocks.
 * No DOM render required — hooks are called directly via renderHook.
 *
 * Full modal flow tests: components.test.tsx (DeleteAccountModal)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeleteAccount } from '../hooks/useDeleteAccount'
import { useDataExport } from '../hooks/useDataExport'

describe('useDeleteAccount', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls DELETE /api/account/delete on deleteAccount()', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const { result } = renderHook(() => useDeleteAccount())
    await act(async () => {
      await result.current.deleteAccount()
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/account/delete')
    expect(opts?.method?.toUpperCase()).toBe('POST')
  })
})

describe('useDataExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the export URL on success', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: 'http://x' }), { status: 200 })
    )

    const { result } = renderHook(() => useDataExport())
    let exportUrl: string | null = null
    await act(async () => {
      exportUrl = await result.current.requestExport()
    })

    expect(exportUrl).toBe('http://x')
  })

  it('sets error to "rate_limited" on 429', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }))

    const { result } = renderHook(() => useDataExport())
    await act(async () => {
      await result.current.requestExport()
    })

    expect(result.current.error).toBe('rate_limited')
  })
})
