/**
 * Todo Types - Enhanced with due dates, priority, tags, notes, recurring, geolocation
 */

export type TodoPriority = 'none' | 'low' | 'medium' | 'high';

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface TodoAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface TodoLocation {
  name: string;
  lat: number;
  lng: number;
  radius?: number; // in meters, default 100
}

export interface Todo {
  id: string;
  user_id: string;
  list_id: string;
  title: string;
  completed: boolean;
  is_public: boolean;
  position: number;

  // Enhanced fields
  due_date: string | null;
  priority: TodoPriority;
  tags: string[];
  notes: string | null;
  reminder_time: string | null;

  // Geolocation
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius: number | null;

  // Recurring
  recurrence_rule: string | null; // "daily", "weekly:monday,wednesday", "monthly:1,15"
  parent_todo_id: string | null; // If this is a recurring instance

  // Attachments
  attachments: TodoAttachment[];

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at: string | null;

  // Computed/joined fields
  list?: {
    id: string;
    title: string;
    color: string;
    icon: string;
  };

  recurring_instance?: RecurringInstance;
}

export interface RecurringInstance {
  id: string;
  parent_todo_id: string;
  instance_date: string; // YYYY-MM-DD
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface CreateTodoInput {
  list_id: string;
  title: string;
  completed?: boolean;
  is_public?: boolean;
  due_date?: string | null;
  priority?: TodoPriority;
  tags?: string[];
  notes?: string | null;
  reminder_time?: string | null;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius?: number | null;
  recurrence_rule?: string | null;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  is_public?: boolean;
  position?: number;
  due_date?: string | null;
  priority?: TodoPriority;
  tags?: string[];
  notes?: string | null;
  reminder_time?: string | null;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius?: number | null;
  recurrence_rule?: string | null;
}

export interface TodoFilters {
  listId?: string;
  completed?: boolean;
  priority?: TodoPriority;
  tags?: string[];
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  hasLocation?: boolean;
  isRecurring?: boolean;
}

export interface TodoSortOptions {
  field: 'position' | 'created_at' | 'due_date' | 'priority' | 'title';
  ascending?: boolean;
}

/**
 * Notification Types
 */

export type NotificationType =
  | 'new_todo'
  | 'due_reminder'
  | 'shared_list'
  | 'evening_reminder'
  | 'location_reminder'
  | 'list_update';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  action_url?: string | null;
}

export interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;

  // Per-type settings
  new_todo: boolean;
  due_reminders: boolean;
  shared_lists: boolean;
  evening_reminder: boolean;
  location_reminders: boolean;
  list_updates: boolean;

  // Timing
  evening_reminder_time: string; // HH:MM format, e.g., "20:00"
  due_reminder_minutes_before: number; // default 60 (1 hour)
}

/**
 * User Preferences Types
 */

export type TimeFormat = '12h' | '24h';

export interface UserPreferences {
  id: string;
  user_id: string;

  // Display preferences
  time_format: TimeFormat;
  auto_hide_completed: boolean;
  theme_preference: 'light' | 'dark' | 'system';
  default_list_id: string | null;

  // Notification settings
  notification_settings: NotificationSettings;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesInput {
  time_format?: TimeFormat;
  auto_hide_completed?: boolean;
  theme_preference?: 'light' | 'dark' | 'system';
  default_list_id?: string | null;
  notification_settings?: Partial<NotificationSettings>;
}

/**
 * Smart Features Types
 */

export interface ParsedDate {
  date: Date;
  confidence: number;
  text: string; // Original text that was parsed
}

export interface SmartSuggestion {
  type: 'tag' | 'location' | 'due_date' | 'priority';
  value: unknown;
  confidence: number;
  reason: string;
}

export interface BulkOperation {
  type: 'complete' | 'delete' | 'move' | 'set_priority' | 'add_tag';
  todo_ids: string[];
  value?: unknown;
}
