/**
 * Purpose: Data layer for the mobile notification centre. Reuses the exact
 *          @nself/ntask-core operations the web NotificationCenterPopover uses
 *          (GET_NOTIFICATIONS, MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ)
 *          so both surfaces read and write np_notifications identically, and adds
 *          the unread-count aggregate as a query.
 * Inputs:  urql executes the operations; callers pass userId / notification id.
 * Outputs: The count query document, the NotificationRow row type, the fetch
 *          limit constant, and pure display helpers (type glyph, relative time).
 * Constraints:
 *   - Web keeps its badge live via SUBSCRIBE_UNREAD_NOTIFICATION_COUNT; the
 *     mobile urql stack has no WebSocket exchange (lib/api.ts builds cache →
 *     error → auth → fetch only), so the badge polls the same aggregate shape
 *     as a query instead. Where-semantics match the web subscription exactly.
 *   - Free plugins only; np_* table naming; no `any`.
 * SPORT: MB-2 notification centre on mobile (web parity)
 */

export { GET_NOTIFICATIONS, MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ } from '@nself/ntask-core';
export type { NpNotification } from '@nself/ntask-core';

import type { NpNotification } from '@nself/ntask-core';

/** Row shape returned by GET_NOTIFICATIONS (it selects no user_id). */
export type NotificationRow = Pick<
  NpNotification,
  'id' | 'type' | 'title' | 'body' | 'read' | 'action_url' | 'data' | 'created_at'
>;

/** Result shape of the unread-count aggregate. */
export interface UnreadCountData {
  np_notifications_aggregate: {
    aggregate: { count: number };
  };
}

/** Query form of the web SUBSCRIBE_UNREAD_NOTIFICATION_COUNT (same where clause). */
export const GET_UNREAD_NOTIFICATION_COUNT = /* GraphQL */`
  query GetUnreadNotificationCount($userId: uuid!) {
    np_notifications_aggregate(
      where: { user_id: { _eq: $userId }, read: { _eq: false } }
    ) {
      aggregate { count }
    }
  }
`;

/** Matches web's getNotifications default page size. */
export const NOTIFICATION_FETCH_LIMIT = 50;

/** Badge display caps at 99+, mirroring the web popover. */
export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** Emoji glyph by notification type — same mapping as the web popover. */
export function typeGlyph(type: NpNotification['type']): string {
  if (type === 'shared_list') return '🔗';
  if (type === 'list_update') return '✏️';
  if (type.includes('reminder')) return '⏰';
  return '✓';
}

/** Minimal translator shape so the helper stays decoupled from react-i18next. */
export type TranslateFn = (key: string, options?: { n?: number; count?: number }) => string;

/** "3h ago"-style label using the same i18n keys the web popover uses. */
export function relativeTime(iso: string, t: TranslateFn): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t('screens:notifications.justNow');
  if (mins < 60) return t('screens:notifications.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('screens:notifications.hoursAgo', { n: hrs });
  return t('screens:notifications.daysAgo', { n: Math.floor(hrs / 24) });
}
