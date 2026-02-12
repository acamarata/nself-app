import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '@/lib/services/notifications';
import type { Notification } from '@/lib/types/todos';
import { toast } from 'sonner';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getNotifications();
      setNotifications(data);

      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await notificationService.markAsRead(notificationId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark as read';
        toast.error(message);
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      toast.error(message);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete notification';
      toast.error(message);
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    try {
      const granted = await notificationService.requestPushPermission();
      if (granted) {
        toast.success('Push notifications enabled');
        await notificationService.subscribeToPush();
      } else {
        toast.error('Push notifications permission denied');
      }
      return granted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request permission';
      toast.error(message);
      return false;
    }
  }, []);

  // Subscribe to real-time notifications
  useEffect(() => {
    fetchNotifications();

    const unsubscribe = notificationService.subscribeToNotifications((updatedNotifications) => {
      setNotifications(updatedNotifications);

      // Count unread
      const unread = updatedNotifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPushPermission,
    refetch: fetchNotifications,
  };
}
