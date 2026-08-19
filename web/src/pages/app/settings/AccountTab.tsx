/**
 * AccountTab.tsx — Settings → Account tab content
 * Purpose: Change email/password, data export, danger zone, sign out.
 *          Extracted sub-component to keep SettingsPage.tsx ≤300 lines.
 * Inputs:  userEmail, onSignOut
 * Constraints: TS strict; dark mode; min-8 password; no external form lib.
 * SPORT:   J-S1-T1, J-S1-T2
 */
import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { PrivacyLinksSection } from './PrivacyLinksSection'
import { DeleteAccountModal } from '@/components/account/DeleteAccountModal'
import { DataExportSection } from './DataExportSection'

interface AccountTabProps {
  userEmail: string
  onSignOut: () => Promise<void>
}
function ChangeEmailSection({ userEmail }: { userEmail: string }) {
  const t = useT('tasks')
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, currentPassword }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
      } else {
        setSuccess(true)
        setOpen(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t('settings.email')}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{userEmail || '—'}</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSuccess(false); setError(null) }}
          className="text-sm font-medium text-brand-primary hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {t('settings.change')}
        </button>
      </div>
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">{t('settings.changeEmail.verify')}</p>
      )}
      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div>
            <label htmlFor="current-password-email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('settings.changeEmail.currentPassword')}
            </label>
            <input
              id="current-password-email"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="new-email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('settings.changeEmail.newEmail')}
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {t('createTask.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {loading ? t('states.saving') : t('settings.changeEmail.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
function ChangePasswordSection() {
  const t = useT('tasks')
  const [open, setOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPw.length < 8) { setError(t('settings.changePassword.minLength')); return }
    if (newPw !== confirmPw) { setError(t('settings.changePassword.mismatch')); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
      } else {
        setSuccess(true)
        setOpen(false)
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.changePassword.title')}</p>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSuccess(false); setError(null) }}
          className="text-sm font-medium text-brand-primary hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          {t('settings.change')}
        </button>
      </div>
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">{t('settings.changePassword.success')}</p>
      )}
      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {([
            { id: 'cur-pw', label: t('settings.changePassword.current'), val: currentPw, set: setCurrentPw, auto: 'current-password' },
            { id: 'new-pw', label: t('settings.changePassword.new'), val: newPw, set: setNewPw, auto: 'new-password' },
            { id: 'conf-pw', label: t('settings.changePassword.confirm'), val: confirmPw, set: setConfirmPw, auto: 'new-password' },
          ] as const).map(({ id, label, val, set, auto }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <input
                id={id}
                type="password"
                required
                autoComplete={auto}
                value={val}
                onChange={(e) => set(e.target.value)}
                disabled={loading}
                placeholder={id === 'new-pw' || id === 'conf-pw' ? '8+ characters' : undefined}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              {t('createTask.cancel')}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50">
              {loading ? t('states.saving') : t('settings.changePassword.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
export function AccountTab({ userEmail, onSignOut }: AccountTabProps) {
  const t = useT('tasks')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <>
      <div className="space-y-4">
        <ChangeEmailSection userEmail={userEmail} />
        <ChangePasswordSection />
        <DataExportSection />

        <div className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            {t('settings.dangerZone')}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.deleteAccount.label')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('settings.deleteAccount.sublabel')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="ml-4 shrink-0 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {t('settings.deleteAccount.button')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t('settings.signOut')}
        </button>

        <PrivacyLinksSection />
      </div>

      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </>
  )
}
