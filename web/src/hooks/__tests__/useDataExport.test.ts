/**
 * useDataExport.test.ts
 *
 * Purpose:    Unit tests for useDataExport hook.
 * Constraints: vitest + @testing-library/react; fetch is mocked globally.
 * SPORT:      J-S1-T2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDataExport } from '../useDataExport'

describe('useDataExport', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls GET /api/account/export and returns URL on 200', async () => {
    const downloadUrl = 'https://storage.nself.org/exports/user-abc-2026.zip'
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ url: downloadUrl }),
    } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDataExport())

    let returned: string | null | undefined
    await act(async () => {
      returned = await result.current.requestExport()
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith('/api/account/export', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }))
    expect(returned).toBe(downloadUrl)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets error="rate_limited" on 429 response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDataExport())

    let returned: string | null | undefined
    await act(async () => {
      returned = await result.current.requestExport()
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe('rate_limited')
    expect(result.current.loading).toBe(false)
  })

  it('sets error on non-200 non-429 response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDataExport())

    let returned: string | null | undefined
    await act(async () => {
      returned = await result.current.requestExport()
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe('Server error')
  })

  it('sets error on fetch network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDataExport())

    let returned: string | null | undefined
    await act(async () => {
      returned = await result.current.requestExport()
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe('Network error')
  })
})
