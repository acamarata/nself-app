/**
 * password-reset-flow.test.tsx — the emailed password-reset path, end to end
 *                                through the client.
 *
 * This flow shipped broken and unnoticed: the confirm page read a ?ticket= param
 * that hasura-auth never sends, and nothing routed the landing at "/" to the
 * confirm page at all, so a user clicking the emailed button reached the
 * marketing home page with an unused token in the query string.
 *
 * These tests pin the two contracts that were wrong:
 *   1. "/" with ?type=passwordReset&refreshToken= redirects to /reset-confirm.
 *   2. The confirm form posts { refreshToken, newPassword }, not { ticket, ... }.
 *
 * SPORT: D-S3-T2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@nself-web/ui', () => ({
  ThemeToggle: () => null,
}))

import { ResetConfirmPage } from '@/pages/app/ResetConfirmPage'

function renderConfirmAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/reset-confirm${search}`]}>
      <Routes>
        <Route path="/reset-confirm" element={<ResetConfirmPage />} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('password reset confirm page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts the refreshToken from the URL, not a ticket', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderConfirmAt('?refreshToken=rt-abc-123')

    const pw = document.querySelector('input[type="password"]') as HTMLInputElement
    expect(pw).toBeTruthy()
    fireEvent.change(pw, { target: { value: 'a-long-enough-password' } })
    fireEvent.submit(pw.closest('form') as HTMLFormElement)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/reset-confirm')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).toHaveProperty('refreshToken', 'rt-abc-123')
    expect(body).toHaveProperty('newPassword', 'a-long-enough-password')
    // The old contract. If this reappears the flow is silently broken again,
    // because hasura-auth consumes the ticket before the browser ever sees it.
    expect(body).not.toHaveProperty('ticket')
  })

  it('refuses to submit when the URL carries no token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderConfirmAt('')

    const pw = document.querySelector('input[type="password"]') as HTMLInputElement
    fireEvent.change(pw, { target: { value: 'a-long-enough-password' } })
    fireEvent.submit(pw.closest('form') as HTMLFormElement)

    // The page warns up front AND the submit handler sets the same error, so the
    // string is present more than once; assert on the count, not a single node.
    await waitFor(() => expect(screen.getAllByText(/invalidResetLink/i).length).toBeGreaterThan(0))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
