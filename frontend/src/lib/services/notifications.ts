import { getBackend } from '../backend';
import type { BackendClient } from '../types/backend';
import { Tables } from '../utils/tables';
import type {
  Notification,
  CreateNotificationInput,
  NotificationType,
} from '../types/todos';

export class NotificationService {
  private backend: BackendClient;

  constructor(backendAdapter: BackendClient) {
    this.backend = backendAdapter;
  }

  // --- In-App Notifications ---

  async getNotifications(limit = 50): Promise<Notification[]> {
    const { data, error } = await this.backend.db.query<Notification>(Tables.NOTIFICATIONS, {
      orderBy: [{ column: 'created_at', ascending: false }],
      limit,
    });

    if (error) throw new Error(error);
    return data || [];
  }

  async getUnreadCount(): Promise<number> {
    const { data, error } = await this.backend.db.query<Notification>(Tables.NOTIFICATIONS, {
      where: { read: false },
    });

    if (error) throw new Error(error);
    return data?.length || 0;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await this.backend.db.update<Notification>(
      Tables.NOTIFICATIONS,
      notificationId,
      { read: true }
    );

    if (error) throw new Error(error);
  }

  async markAllAsRead(): Promise<void> {
    const unread = await this.backend.db.query<Notification>(Tables.NOTIFICATIONS, {
      where: { read: false },
    });

    if (unread.data) {
      await Promise.all(unread.data.map((n) => this.markAsRead(n.id)));
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await this.backend.db.remove(Tables.NOTIFICATIONS, notificationId);

    if (error) throw new Error(error);
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await this.backend.db.insert<Notification>(Tables.NOTIFICATIONS, {
      user_id: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data || {},
      read: false,
      action_url: input.action_url || null,
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to create notification');
    return data;
  }

  // --- Push Notifications ---

  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async sendPushNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      // Send subscription to backend
      await this.backend.functions.invoke('save_push_subscription', {
        subscription: subscription.toJSON(),
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove subscription from backend
        await this.backend.functions.invoke('remove_push_subscription', {
          endpoint: subscription.endpoint,
        });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    }
  }

  // --- Real-time Subscription ---

  subscribeToNotifications(callback: (notifications: Notification[]) => void): () => void {
    const user = this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const channelName = `${Tables.NOTIFICATIONS}`;
    const channel = this.backend.realtime.channel(channelName);

    channel
      .on('*', async () => {
        const notifications = await this.getNotifications();
        callback(notifications);
      })
      .subscribe();

    return () => {
      this.backend.realtime.removeChannel(channelName);
    };
  }

  // --- Helpers ---

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // --- Notification Templates ---

  async notifyNewTodo(todoTitle: string, listTitle: string, listId: string): Promise<void> {
    await this.createNotification({
      type: 'new_todo',
      title: 'New Todo Created',
      body: `"${todoTitle}" added to ${listTitle}`,
      action_url: `/lists/${listId}`,
    });

    await this.sendPushNotification('New Todo', {
      body: `"${todoTitle}" added to ${listTitle}`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
    });
  }

  async notifyDueReminder(todoTitle: string, listId: string, minutesUntilDue: number): Promise<void> {
    const timeStr = minutesUntilDue < 60 ? `${minutesUntilDue} minutes` : `${Math.floor(minutesUntilDue / 60)} hours`;

    await this.createNotification({
      type: 'due_reminder',
      title: 'Todo Due Soon',
      body: `"${todoTitle}" is due in ${timeStr}`,
      action_url: `/lists/${listId}`,
    });

    await this.sendPushNotification('Todo Due Soon', {
      body: `"${todoTitle}" is due in ${timeStr}`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'due-reminder',
    });
  }

  async notifySharedList(listTitle: string, sharedByEmail: string, listId: string): Promise<void> {
    await this.createNotification({
      type: 'shared_list',
      title: 'List Shared With You',
      body: `${sharedByEmail} shared "${listTitle}" with you`,
      action_url: `/lists/${listId}`,
    });

    await this.sendPushNotification('List Shared', {
      body: `${sharedByEmail} shared "${listTitle}" with you`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
    });
  }

  async notifyEveningReminder(): Promise<void> {
    await this.createNotification({
      type: 'evening_reminder',
      title: 'Plan Tomorrow',
      body: 'Anything you'd like to add to your todo list for tomorrow?',
      action_url: '/lists',
    });

    await this.sendPushNotification('Plan Tomorrow', {
      body: 'Anything you'd like to add to your todo list for tomorrow?',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'evening-reminder',
    });
  }

  async notifyLocationReminder(listTitle: string, locationName: string, listId: string): Promise<void> {
    await this.createNotification({
      type: 'location_reminder',
      title: `Near ${locationName}`,
      body: `Don't forget: ${listTitle}`,
      action_url: `/lists/${listId}`,
    });

    await this.sendPushNotification(`Near ${locationName}`, {
      body: `Don't forget: ${listTitle}`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `location-${listId}`,
    });
  }

  async notifyListUpdate(listTitle: string, updateType: string, listId: string): Promise<void> {
    await this.createNotification({
      type: 'list_update',
      title: 'List Updated',
      body: `${updateType} in "${listTitle}"`,
      action_url: `/lists/${listId}`,
    });
  }
}

export const notificationService = new NotificationService(getBackend());
