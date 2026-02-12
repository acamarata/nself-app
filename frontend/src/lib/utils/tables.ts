/**
 * Table Name Utilities
 *
 * Provides monorepo-friendly table naming with configurable prefixes.
 * When using this boilerplate in a monorepo with multiple apps sharing
 * one backend, set NEXT_PUBLIC_TABLE_PREFIX to a unique value per app.
 *
 * Examples:
 * - App 1: NEXT_PUBLIC_TABLE_PREFIX=dashboard
 * - App 2: NEXT_PUBLIC_TABLE_PREFIX=admin
 * - App 3: NEXT_PUBLIC_TABLE_PREFIX=customer
 *
 * This prevents table name conflicts between apps.
 */

import { config } from '../config';

/**
 * Get the full table name with the configured prefix.
 *
 * @param baseName - The base table name (e.g., 'todos', 'profiles')
 * @returns The prefixed table name (e.g., 'myapp_todos', 'myapp_profiles')
 *
 * @example
 * // With NEXT_PUBLIC_TABLE_PREFIX=dashboard
 * getTableName('todos') // => 'dashboard_todos'
 *
 * @example
 * // With default prefix (app)
 * getTableName('profiles') // => 'app_profiles'
 */
export function getTableName(baseName: string): string {
  const prefix = config.tablePrefix || 'app';
  return `${prefix}_${baseName}`;
}

/**
 * Table names with configured prefix.
 * Import these instead of using hardcoded strings.
 */
export const Tables = {
  TODOS: getTableName('todos'),
  PROFILES: getTableName('profiles'),
  TODO_SHARES: getTableName('todo_shares'),
  LISTS: getTableName('lists'),
  LIST_SHARES: getTableName('list_shares'),
  LIST_PRESENCE: getTableName('list_presence'),
  NOTIFICATIONS: getTableName('notifications'),
  RECURRING_INSTANCES: getTableName('recurring_instances'),
  USER_PREFERENCES: getTableName('user_preferences'),
  ROLES: getTableName('roles'),
  PERMISSIONS: getTableName('permissions'),
  ROLE_PERMISSIONS: getTableName('role_permissions'),
  USER_ROLES: getTableName('user_roles'),
  USER_PERMISSIONS: getTableName('user_permissions'),
} as const;
