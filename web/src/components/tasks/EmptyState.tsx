/**
 * EmptyState.tsx — Canonical empty/error state display component
 *
 * Purpose:    Renders a centered empty state with optional icon, title,
 *             description, and either an action node or a router `cta` link.
 *             Used when lists or todos are empty, and (via ErrorState) when a
 *             page-level fetch fails. Consolidates the former root-level
 *             src/components/EmptyState.tsx (Link-based cta + ErrorState) into
 *             this single canonical implementation to remove duplication.
 * Inputs:     icon?: string, title: string, description?: string,
 *             action?: ReactNode, cta?: { label: string; href: string }
 * Outputs:    Centered empty state UI block; ErrorState variant for fetch errors
 * Constraints: Must not assume any minimum height — let parent container control
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { Link } from 'react-router-dom'
import { useT } from '@/lib/i18n'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  /** Optional internal-link call to action, rendered below description/action. */
  cta?: { label: string; href: string }
}

export function EmptyState({ icon = '', title, description, action, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
      {cta && (
        <Link
          to={cta.href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  const t = useT('tasks')
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        {t('emptyState.somethingWrong')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {message || t('emptyState.somethingWrong')}
      </p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium text-sky-600 hover:underline">
            {t('emptyState.tryAgain')}
          </button>
        )}
        <Link to="/support" className="text-sm font-medium text-gray-500 hover:underline">
          {t('emptyState.contactSupport')}
        </Link>
      </div>
    </div>
  )
}
