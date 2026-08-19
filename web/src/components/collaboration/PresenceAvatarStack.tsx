/**
 * PresenceAvatarStack.tsx — Overlapping avatar circles for online list members
 *
 * Purpose:    Show who else is currently viewing or editing the same list in real-time.
 *             Renders up to 4 initials-based avatars with overflow count.
 * Inputs:     listId — the UUID of the list whose presence to subscribe to
 * Outputs:    A row of overlapping 28px avatar circles, or null if ≤1 presence entry
 * Constraints: Returns null when alone (only current user). Heartbeat managed by
 *              usePresenceHeartbeat (handles upsert + cleanup on unmount). No external
 *              avatar images — initials fallback only. Max 4 avatars + "+N" overflow.
 * SPORT:      T-P5-E1-collab-presence
 */
import { useSubscription } from '@/hooks/useSubscription'
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'
import { SUBSCRIBE_LIST_PRESENCE } from '@nself/ntask-core'
import type { NpListPresence } from '@nself/ntask-core'
import { useT } from '@/lib/i18n'

const AVATAR_COLORS = [
  'bg-indigo-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
] as const

const MAX_VISIBLE = 4

interface PresenceAvatarStackProps {
  listId: string
}

interface PresenceData {
  np_list_presence: NpListPresence[]
}

export function PresenceAvatarStack({ listId }: PresenceAvatarStackProps) {
  const t = useT('tasks')

  // Heartbeat: upsert our own presence record, remove on unmount
  usePresenceHeartbeat(listId, true)

  const { data } = useSubscription<PresenceData>(
    SUBSCRIBE_LIST_PRESENCE,
    { listId },
    { enabled: !!listId },
  )

  const presences = data?.np_list_presence ?? []

  // Don't show the stack if alone or no data yet
  if (presences.length <= 1) return null

  const visible = presences.slice(0, MAX_VISIBLE)
  const overflow = presences.length - MAX_VISIBLE

  return (
    <div
      className="flex items-center"
      role="group"
      aria-label={t('collab.presence')}
    >
      {visible.map((p, index) => {
        const initial = p.profile?.display_name
          ? p.profile.display_name.charAt(0).toUpperCase()
          : p.user_id.charAt(0).toUpperCase()
        const colorClass = AVATAR_COLORS[index % AVATAR_COLORS.length]

        return (
          <div
            key={p.id}
            title={t('collab.online')}
            className={[
              'relative flex h-7 w-7 shrink-0 items-center justify-center',
              'rounded-full text-[11px] font-semibold select-none',
              'ring-2 ring-white dark:ring-gray-950',
              index > 0 ? '-ml-2' : '',
              colorClass,
            ].join(' ')}
            style={{ zIndex: MAX_VISIBLE - index }}
            aria-label={t('collab.online')}
          >
            {initial}
          </div>
        )
      })}

      {overflow > 0 && (
        <div
          className={[
            'relative -ml-2 flex h-7 w-7 shrink-0 items-center justify-center',
            'rounded-full text-[11px] font-semibold select-none',
            'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
            'ring-2 ring-white dark:ring-gray-950',
          ].join(' ')}
          title={`+${overflow} ${t('collab.moreOnline')}`}
          aria-label={`+${overflow} ${t('collab.moreOnline')}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
