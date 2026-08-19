/**
 * useDeleteAccount.test.ts
 *
 * Purpose:    Unit tests for useDeleteAccount hook.
 * Constraints: vitest + @testing-library/react; fetch is mocked globally.
 * SPORT:      J-S1-T2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeleteAccount } from '../useDeleteAccount'

describe('useDeleteAccount', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls POST /api/account/delete and returns true on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDeleteAccount())

    let returned: boolean | undefined
    await act(async () => {
      returned = await result.current.deleteAccount()
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(returned).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets error state and returns false on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    } as Response)
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDeleteAccount())

    let returned: boolean | undefined
    await act(async () => {
      returned = await result.current.deleteAccount()
    })

    expect(returned).toBe(false)
    expect(result.current.error).toBe('Forbidden')
    expect(result.current.loading).toBe(false)
  })

  it('sets generic error on fetch failure', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useDeleteAccount())

    let returned: boolean | undefined
    await act(async () => {
      returned = await result.current.deleteAccount()
    })

    expect(returned).toBe(false)
    expect(result.current.error).toBe('Network error')
  })
})
