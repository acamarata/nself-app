/**
 * SecurityTab.tsx — Settings → Security tab (MFA + active sessions)
 * Purpose: Parity with mobile MfaSetupScreen + SessionsScreen — enable/disable
 *          TOTP 2FA, list and revoke active sessions. Extracted from
 *          SettingsPage.tsx to keep that file under the 300-line cap.
 * Inputs: None — self-contained; talks to Hasura Actions via graphql-account.ts.
 * Outputs: MFA enroll/disable flow; session list with revoke buttons.
 * Constraints: <300 lines. MFA on/off reflects the server-side
 *              task_users.mfa_enabled flag (migration 027) via getMfaStatus,
 *              refetched after enable/disable succeeds — no longer purely
 *              local UI state (superseded the prior client-only limitation
 *              that matched apps/mobile/src/app/MfaSetupScreen.tsx).
 * SPORT: J-S2 aux — enableMfa/disableMfa/listSessions/revokeSession web parity.
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { enableMfa, disableMfa, listSessions, revokeSession, getMfaStatus } from '@/lib/graphql-account'
import type { AccountSession } from '@/lib/graphql-account'

function MfaSection() {
  const t = useT('tasks')
  const [enabled, setEnabled] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [step, setStep] = useState<'info' | 'secret'>('info')
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMfaStatus().then((status) => {
      if (!cancelled) { setEnabled(status); setStatusLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  async function handleBeginSetup() {
    setLoading(true)
    const result = await enableMfa()
    if (result?.success && result.totpSecret) {
      setSecret(result.totpSecret)
      setQrCodeUrl(result.qrCodeUrl ?? '')
      setStep('secret')
    }
    setLoading(false)
  }

  function handleCopySecret() {
    navigator.clipboard?.writeText(secret)
    setMessage(t('settings.mfa.keyCopied'))
    setTimeout(() => setMessage(null), 2000)
  }

  async function handleDoneEnable() {
    setMessage(t('settings.mfa.enabledSuccess'))
    setStep('info')
    setEnabled(await getMfaStatus())
  }

  async function handleDisable() {
    if (otp.length !== 6) return
    setLoading(true)
    const ok = await disableMfa(otp)
    if (ok) {
      setOtp('')
      setMessage(t('settings.mfa.disabledSuccess'))
      setEnabled(await getMfaStatus())
    }
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.mfa.title')}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {statusLoading ? t('states.loading') : enabled ? t('settings.mfa.enabled') : t('settings.mfa.disabled')}
        </p>
      </div>

      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

      {statusLoading ? null : enabled ? (
        <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          <label htmlFor="mfa-disable-otp" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('settings.mfa.otpLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="mfa-disable-otp"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('settings.mfa.otpPlaceholder')}
              maxLength={6}
              className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-center tracking-widest text-gray-900 dark:text-white focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={handleDisable}
              disabled={loading || otp.length !== 6}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {t('settings.mfa.disable')}
            </button>
          </div>
        </div>
      ) : step === 'info' ? (
        <button
          type="button"
          onClick={handleBeginSetup}
          disabled={loading}
          className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {t('settings.mfa.beginSetup')}
        </button>
      ) : (
        <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.mfa.scanHint')}</p>
          <div>
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('settings.mfa.secretKey')}</span>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                {secret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-brand-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t('settings.mfa.copyKey')}
              </button>
            </div>
          </div>
          {qrCodeUrl && (
            <div>
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('settings.mfa.qrUrl')}</span>
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 break-all">
                {qrCodeUrl}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleDoneEnable}
            className="w-full rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
          >
            {t('settings.mfa.done')}
          </button>
        </div>
      )}
    </div>
  )
}

function SessionsSection() {
  const t = useT('tasks')
  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listSessions().then((result) => {
      if (!cancelled) { setSessions(result); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  async function handleRevoke(id: string) {
    if (!window.confirm(t('settings.sessions.revokeConfirm'))) return
    setRevokingId(id)
    const ok = await revokeSession(id)
    if (ok) setSessions((prev) => prev.filter((s) => s.id !== id))
    setRevokingId(null)
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.sessions.title')}</p>

      {loading && <p className="text-sm text-gray-400 animate-pulse">{t('states.loading')}</p>}

      {!loading && sessions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('settings.sessions.empty')}</p>
      )}

      {!loading && sessions.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {sessions.map((s, index) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {index === 0 ? t('settings.sessions.thisDevice') : s.id.slice(0, 8)}
                </p>
                {s.createdAt && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('settings.sessions.createdAt').replace('{{date}}', new Date(s.createdAt).toLocaleDateString())}
                  </p>
                )}
              </div>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => handleRevoke(s.id)}
                  disabled={revokingId === s.id}
                  className="shrink-0 rounded-md border border-red-200 dark:border-red-800 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {revokingId === s.id ? t('settings.sessions.revoked') : t('settings.sessions.revoke')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SecurityTab() {
  return (
    <div className="space-y-4">
      <MfaSection />
      <SessionsSection />
    </div>
  )
}
