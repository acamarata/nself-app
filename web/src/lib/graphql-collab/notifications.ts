/**
 * Purpose: Notification ops — fetch, mark one read, mark all read.
 * Inputs:  userId, notification id, optional limit.
 * Outputs: Typed NpNotification rows and success booleans.
 * Constraints: gql() cookie-auth HTTP client; TS strict; no `any`.
 * SPORT:   D2-COLLAB-GQL
 */
import { gql } from '../api';
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from '@nself/ntask-core';
import type { NpNotification } from '@nself/ntask-core';

export async function getNotifications(userId: string, limit?: number): Promise<NpNotification[]> {
  const res = await gql<{ np_notifications: NpNotification[] }>(GET_NOTIFICATIONS, {
    userId,
    limit: limit ?? 50,
  });
  if (res.error || !res.data) return [];
  return res.data.np_notifications;
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const res = await gql<{ update_np_notifications_by_pk: { id: string } | null }>(
    MARK_NOTIFICATION_READ,
    { id },
  );
  return !res.error && !!res.data?.update_np_notifications_by_pk;
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const res = await gql<{ update_np_notifications: { affected_rows: number } }>(
    MARK_ALL_NOTIFICATIONS_READ,
    { userId },
  );
  return !res.error && (res.data?.update_np_notifications.affected_rows ?? 0) >= 0;
}
