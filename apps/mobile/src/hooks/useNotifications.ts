/**
 * Purpose: Full notification-centre data hook — newest-first np_notifications list
 *          for the signed-in user plus mark-read mutations, using the SAME
 *          @nself/ntask-core operations the web NotificationCenterPopover uses so
 *          read state and the unread badge stay in sync across surfaces.
 * Inputs:  useAuth() access token (decoded locally for the userId parameter).
 * Outputs: { notifications, unreadCount, loading, error, refetch, markRead, markAllRead }
 * Constraints:
 *   - markRead/markAllRead run MARK_NOTIFICATION_READ / MARK_ALL_NOTIFICATIONS_READ
 *     verbatim; a web client watching the same rows sees the update immediately.
 *   - After a successful mutation both the list and the unread-count aggregate
 *     re-execute network-only — the badge clears without waiting for the poll.
 *   - Paused while auth is unresolved; must render inside <UrqlProvider>.
 * SPORT: MB-2 notification centre on mobile (web parity)
 */

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery } from 'urql';
import { useAuth } from './useAuth';
import { useUnreadNotificationCount } from './useUnreadNotificationCount';
import { decodeUserIdFromJwt } from '../lib/jwt';
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
  NOTIFICATION_FETCH_LIMIT,
  type NotificationRow,
} from '../lib/notifications';

interface NotificationsData {
  np_notifications: NotificationRow[];
}

export interface UseNotificationsResult {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: unknown;
  refetch: () => void;
  markRead: (id: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsResult {
  const { accessToken } = useAuth();
  const userId = useMemo(() => decodeUserIdFromJwt(accessToken), [accessToken]);

  const [listResult, reexecuteList] = useQuery<NotificationsData>({
    query: GET_NOTIFICATIONS,
    variables: { userId, limit: NOTIFICATION_FETCH_LIMIT },
    pause: !userId,
    requestPolicy: 'cache-and-network',
  });

  const { unreadCount, refetch: refetchCount } = useUnreadNotificationCount();
  const [, execMarkRead] = useMutation(MARK_NOTIFICATION_READ);
  const [, execMarkAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const refetch = useCallback(() => {
    reexecuteList({ requestPolicy: 'network-only' });
    refetchCount();
  }, [reexecuteList, refetchCount]);

  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await execMarkRead({ id });
      if (!result.error) refetch();
      return !result.error;
    },
    [execMarkRead, refetch],
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const result = await execMarkAllRead({ userId });
    if (!result.error) refetch();
    return !result.error;
  }, [userId, execMarkAllRead, refetch]);

  return {
    notifications: listResult.data?.np_notifications ?? [],
    unreadCount,
    loading: listResult.fetching,
    error: listResult.error,
    refetch,
    markRead,
    markAllRead,
  };
}
