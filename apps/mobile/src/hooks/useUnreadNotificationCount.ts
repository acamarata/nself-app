/**
 * Purpose: Live unread count for np_notifications — the mobile stand-in for the
 *          web bell's SUBSCRIBE_UNREAD_NOTIFICATION_COUNT. The mobile urql client
 *          has no WebSocket exchange, so the same aggregate runs as a polled query.
 * Inputs:  useAuth() access token (decoded locally for the userId parameter).
 * Outputs: { unreadCount, refetch } — count of read=false rows for the caller.
 * Constraints:
 *   - Paused while the token/userId is unresolved (auth still loading).
 *   - Poll cadence 60s network-only; a fresh count also lands whenever the
 *     shared aggregate re-executes after a mark-read mutation.
 *   - Must be rendered inside <UrqlProvider>. Never throws on auth hiccups —
 *     count simply stays at its last value.
 * SPORT: MB-2 notification centre on mobile (web parity)
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from 'urql';
import { useAuth } from './useAuth';
import { decodeUserIdFromJwt } from '../lib/jwt';
import { GET_UNREAD_NOTIFICATION_COUNT, type UnreadCountData } from '../lib/notifications';

const POLL_INTERVAL_MS = 60_000;

export function useUnreadNotificationCount(): { unreadCount: number; refetch: () => void } {
  const { accessToken } = useAuth();
  const userId = useMemo(() => decodeUserIdFromJwt(accessToken), [accessToken]);

  const [result, reexecute] = useQuery<UnreadCountData>({
    query: GET_UNREAD_NOTIFICATION_COUNT,
    variables: { userId },
    pause: !userId,
    requestPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => reexecute({ requestPolicy: 'network-only' }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, reexecute]);

  const refetch = useCallback(() => reexecute({ requestPolicy: 'network-only' }), [reexecute]);

  return {
    unreadCount: result.data?.np_notifications_aggregate?.aggregate?.count ?? 0,
    refetch,
  };
}
