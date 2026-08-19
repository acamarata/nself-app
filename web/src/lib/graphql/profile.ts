/**
 * Purpose: Typed profile + user-preferences ops over @nself/ntask-core operations.
 * Inputs: Profile operation strings from ntask-core, gql() HTTP client from api.ts.
 * Outputs: NpProfile / NpUserPreferences domain objects.
 * Constraints: Cookie auth only (browser); no Bearer tokens here.
 * SPORT: D-S1-T2 data layer rewire.
 */
import { gql } from '../api';
import {
  GET_PROFILE,
  UPDATE_PROFILE,
  GET_USER_PREFERENCES,
  UPDATE_PREFERENCES,
} from '@nself/ntask-core';
import type {
  NpProfile,
  NpUserPreferences,
  UpdateProfileInput,
  UpdatePreferencesInput,
} from '@nself/ntask-core';

export async function getProfile(): Promise<NpProfile | null> {
  const res = await gql<{ np_profiles: NpProfile[] }>(GET_PROFILE);
  if (res.error || !res.data || res.data.np_profiles.length === 0) return null;
  return res.data.np_profiles[0] ?? null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<NpProfile | null> {
  // UPDATE_PROFILE declares flat variables ($userId, $displayName, $bio,
  // $avatarUrl) and keys np_profiles by its pk (= the user id), not { id, input }
  // (see packages/@nself/ntask-core/src/operations/profiles.ts).
  const res = await gql<{ update_np_profiles_by_pk: NpProfile }>(UPDATE_PROFILE, {
    userId,
    displayName: input.display_name,
    bio: input.bio,
    avatarUrl: input.avatar_url,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_profiles_by_pk;
}

export async function getUserPreferences(): Promise<NpUserPreferences | null> {
  const res = await gql<{ np_user_preferences: NpUserPreferences[] }>(GET_USER_PREFERENCES);
  if (res.error || !res.data || res.data.np_user_preferences.length === 0) return null;
  return res.data.np_user_preferences[0] ?? null;
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<NpUserPreferences | null> {
  // UPDATE_PREFERENCES declares flat variables ($userId, $timeFormat,
  // $autoHideCompleted, $themePreference, $defaultListId, $notificationSettings)
  // — NOT { id, input }. It filters np_user_preferences by user_id and returns
  // an { affected_rows, returning[] } payload, not a *_by_pk object (see
  // packages/@nself/ntask-core/src/operations/profiles.ts).
  const res = await gql<{ update_np_user_preferences: { returning: NpUserPreferences[] } }>(UPDATE_PREFERENCES, {
    userId,
    timeFormat: input.time_format,
    autoHideCompleted: input.auto_hide_completed,
    themePreference: input.theme_preference,
    defaultListId: input.default_list_id,
    notificationSettings: input.notification_settings,
  });
  if (res.error || !res.data) return null;
  return res.data.update_np_user_preferences.returning[0] ?? null;
}
