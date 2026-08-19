/**
 * local-prefs.ts — Client-only display preferences not backed by a database column.
 *
 * Purpose:    Week-start day and date-display format are UI-only preferences —
 *             np_user_preferences (backend/postgres) has no week_start or
 *             date_format column (only time_format, theme_preference,
 *             auto_hide_completed, default_list_id, notification_settings
 *             exist — see packages/@nself/ntask-core/src/types/profile.ts).
 *             Persisting these server-side needs a migration + Hasura column
 *             exposure, which is out of scope for a web-app-only fix.
 *             This module makes the SettingsPage controls actually take
 *             effect + survive reload via localStorage, instead of being
 *             inert onChange={()=>{}} handlers.
 * Inputs:     None.
 * Outputs:    Typed getters/setters, defaulting to 'sunday' / 'MM/DD/YYYY'.
 * Constraints: Same localStorage-with-try/catch pattern as lib/app-mode.ts —
 *              safe under privacy mode / SSR / test environments.
 * SPORT: D2-S5-T1 SettingsPage dead-control fix.
 */

export type WeekStart = 'sunday' | 'monday' | 'saturday'
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'

const WEEK_START_KEY = 'ntask_week_start'
const DATE_FORMAT_KEY = 'ntask_date_format'

const WEEK_STARTS: readonly WeekStart[] = ['sunday', 'monday', 'saturday']
const DATE_FORMATS: readonly DateFormat[] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

function isWeekStart(value: string): value is WeekStart {
  return (WEEK_STARTS as readonly string[]).includes(value)
}

function isDateFormat(value: string): value is DateFormat {
  return (DATE_FORMATS as readonly string[]).includes(value)
}

export function getWeekStart(): WeekStart {
  try {
    const stored = window.localStorage?.getItem(WEEK_START_KEY)
    return stored && isWeekStart(stored) ? stored : 'sunday'
  } catch {
    return 'sunday'
  }
}

export function setWeekStart(value: WeekStart): void {
  try {
    window.localStorage?.setItem(WEEK_START_KEY, value)
  } catch {
    // localStorage unavailable — in-session only
  }
}

export function getDateFormat(): DateFormat {
  try {
    const stored = window.localStorage?.getItem(DATE_FORMAT_KEY)
    return stored && isDateFormat(stored) ? stored : 'MM/DD/YYYY'
  } catch {
    return 'MM/DD/YYYY'
  }
}

export function setDateFormat(value: DateFormat): void {
  try {
    window.localStorage?.setItem(DATE_FORMAT_KEY, value)
  } catch {
    // localStorage unavailable — in-session only
  }
}
