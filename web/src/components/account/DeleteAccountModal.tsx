/**
 * DeleteAccountModal.tsx — irreversible account deletion confirmation dialog
 *
 * Purpose:    Two-step modal guard: warning explanation → "type DELETE" confirmation.
 *             On confirm, calls useDeleteAccount, then signs out and redirects to /login.
 * Inputs:     onClose: () => void
 * Outputs:    Triggers DELETE /api/account/delete, then auth.signOut(), then navigation.
 * Constraints: WCAG 2.1 AA — aria-modal, role="dialog", aria-labelledby, focus trap on open.
 *              Red danger styling. No external modal lib.
 * SPORT:      J-S1-T2
 */
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useDeleteAccount } from '@/hooks/useDeleteAccount'
import { useT } from '@/lib/i18n'

const CONFIRM_PHRASE = 'DELETE'

interface DeleteAccountModalProps {
  onClose: () => void
}

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const t = useT('tasks')
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { deleteAccount, loading, error } = useDeleteAccount()
  const [confirmText, setConfirmText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const headingId = 'delete-account-modal-heading'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [loading, onClose])

  async function handleDelete() {
    if (confirmText !== CONFIRM_PHRASE || loading) return
    const ok = await deleteAccount()
    if (ok) {
      await signOut()
      navigate('/login', { replace: true })
    }
  }

  const confirmed = confirmText === CONFIRM_PHRASE

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 p-6 shadow-xl"
      >
        <h2
          id={headingId}
          className="text-lg font-bold text-red-600 dark:text-red-400 mb-3"
        >
          {t('settings.deleteAccount.title')}
        </h2>

        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 mb-5 text-sm text-red-700 dark:text-red-300 space-y-1">
          <p className="font-medium">{t('settings.deleteAccount.warning')}</p>
          <ul className="list-disc list-inside space-y-0.5 mt-1 text-red-600 dark:text-red-400">
            <li>{t('settings.deleteAccount.item1')}</li>
            <li>{t('settings.deleteAccount.item2')}</li>
            <li>{t('settings.deleteAccount.item3')}</li>
          </ul>
          <p className="pt-1">{t('settings.deleteAccount.irreversible')}</p>
        </div>

        <label
          htmlFor="delete-confirm"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t('settings.deleteAccount.typePrompt')}{' '}
          <span className="font-mono font-bold text-red-600 dark:text-red-400">{CONFIRM_PHRASE}</span>
          {' '}{t('settings.deleteAccount.typePromptSuffix')}
        </label>
        <input
          ref={inputRef}
          id="delete-confirm"
          aria-label="delete-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono transition-colors focus:outline-none focus:ring-1 disabled:opacity-50 dark:bg-gray-800 dark:text-white ${
            confirmText.length > 0
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-brand-primary'
          }`}
          placeholder={CONFIRM_PHRASE}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {t('createTask.cancel')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmed || loading}
            aria-disabled={!confirmed || loading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('settings.deleteAccount.deleting') : t('settings.deleteAccount.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
