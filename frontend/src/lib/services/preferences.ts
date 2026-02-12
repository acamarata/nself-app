import { getBackend } from '../backend';
import type { BackendClient } from '../types/backend';
import { Tables } from '../utils/tables';
import type { UserPreferences, UpdatePreferencesInput, NotificationSettings } from '../types/todos';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  push_enabled: true,
  email_enabled: true,
  new_todo: true,
  due_reminders: true,
  shared_lists: true,
  evening_reminder: true,
  location_reminders: true,
  list_updates: true,
  evening_reminder_time: '20:00',
  due_reminder_minutes_before: 60,
};

export class PreferencesService {
  private backend: BackendClient;

  constructor(backendAdapter: BackendClient) {
    this.backend = backendAdapter;
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await this.backend.db.query<UserPreferences>(Tables.USER_PREFERENCES, {
      where: { user_id: user.id },
    });

    if (error) throw new Error(error);

    if (data && data.length > 0) {
      return data[0];
    }

    // Create default preferences if they don't exist
    return this.createDefaultPreferences();
  }

  async createDefaultPreferences(): Promise<UserPreferences> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await this.backend.db.insert<UserPreferences>(Tables.USER_PREFERENCES, {
      user_id: user.id,
      time_format: '12h',
      auto_hide_completed: false,
      theme_preference: 'system',
      default_list_id: null,
      notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
    });

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to create preferences');
    return data;
  }

  async updatePreferences(input: UpdatePreferencesInput): Promise<UserPreferences> {
    const user = await this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const existing = await this.getPreferences();
    if (!existing) throw new Error('Preferences not found');

    // Merge notification settings if provided
    const updateData: Record<string, unknown> = { ...input };
    if (input.notification_settings) {
      updateData.notification_settings = {
        ...existing.notification_settings,
        ...input.notification_settings,
      };
    }

    const { data, error } = await this.backend.db.update<UserPreferences>(
      Tables.USER_PREFERENCES,
      existing.id,
      updateData
    );

    if (error) throw new Error(error);
    if (!data) throw new Error('Failed to update preferences');
    return data;
  }

  async setTimeFormat(format: '12h' | '24h'): Promise<void> {
    await this.updatePreferences({ time_format: format });
  }

  async setAutoHideCompleted(autoHide: boolean): Promise<void> {
    await this.updatePreferences({ auto_hide_completed: autoHide });
  }

  async setThemePreference(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.updatePreferences({ theme_preference: theme });
  }

  async setDefaultList(listId: string | null): Promise<void> {
    await this.updatePreferences({ default_list_id: listId });
  }

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    await this.updatePreferences({ notification_settings: settings });
  }

  async enablePushNotifications(enabled: boolean): Promise<void> {
    await this.updateNotificationSettings({ push_enabled: enabled });
  }

  async enableEmailNotifications(enabled: boolean): Promise<void> {
    await this.updateNotificationSettings({ email_enabled: enabled });
  }

  async setEveningReminderTime(time: string): Promise<void> {
    await this.updateNotificationSettings({ evening_reminder_time: time });
  }

  async setDueReminderMinutes(minutes: number): Promise<void> {
    await this.updateNotificationSettings({ due_reminder_minutes_before: minutes });
  }

  // --- Helpers ---

  formatTime(date: Date, format: '12h' | '24h' = '12h'): string {
    if (format === '24h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatDateTime(date: Date, timeFormat: '12h' | '24h' = '12h'): string {
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const timeStr = this.formatTime(date, timeFormat);

    return `${dateStr} at ${timeStr}`;
  }

  parseTime(timeStr: string): { hours: number; minutes: number } | null {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return { hours, minutes };
  }

  // --- Real-time Subscription ---

  subscribeToPreferences(callback: (preferences: UserPreferences) => void): () => void {
    const user = this.backend.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const channelName = `${Tables.USER_PREFERENCES}`;
    const channel = this.backend.realtime.channel(channelName);

    channel
      .on('*', async () => {
        const preferences = await this.getPreferences();
        if (preferences) callback(preferences);
      })
      .subscribe();

    return () => {
      this.backend.realtime.removeChannel(channelName);
    };
  }
}

export const preferencesService = new PreferencesService(getBackend());
