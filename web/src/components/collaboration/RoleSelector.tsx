/**
 * RoleSelector.tsx — Permission role chip selector
 *
 * Purpose:    Two-chip toggle (Viewer / Editor) for picking a collaboration
 *             permission level. Used in ShareListDialog invite form and
 *             share-link generation.
 * Inputs:     value: 'viewer'|'editor', onChange callback, optional disabled flag
 * Outputs:    Two accessible button chips; fires onChange on selection change
 * Constraints: No Radix — plain button elements with aria-pressed
 * SPORT: P5-W1-collab-role-selector
 */

import { useT } from '@/lib/i18n'

type Role = 'viewer' | 'editor'

interface RoleSelectorProps {
  value: Role
  onChange: (role: Role) => void
  disabled?: boolean
}

const ROLES: Array<{ id: Role; labelKey: string }> = [
  { id: 'viewer', labelKey: 'collab.roleViewer' },
  { id: 'editor', labelKey: 'collab.roleEditor' },
]

export function RoleSelector({ value, onChange, disabled = false }: RoleSelectorProps) {
  const t = useT('tasks')

  return (
    <div className="flex gap-1" role="group" aria-label={t('collab.roleLabel')}>
      {ROLES.map((role) => {
        const isActive = value === role.id
        return (
          <button
            key={role.id}
            type="button"
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(role.id)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isActive
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            {t(role.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
