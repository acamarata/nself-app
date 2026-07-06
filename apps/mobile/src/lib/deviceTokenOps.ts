/**
 * Purpose: GraphQL operation for registering an Expo push token into np_device_tokens.
 *          Not yet in @nself/ntask-core so defined inline here (same convention as
 *          collabOps.ts / accountOps.ts).
 * Inputs:  n/a (document node export consumed by usePushToken via urql)
 * Outputs: TypedDocumentNode-compatible gql tag object
 * Constraints:
 *   - Targets np_device_tokens (migration 017_add_device_tokens.sql): columns are
 *     platform ('ios'|'android'|'web'), token (globally UNIQUE), last_seen_at.
 *     user_id is NOT passed — Hasura's insert_permissions `set` clause stamps it
 *     from X-Hasura-User-Id automatically (see tables.yaml np_device_tokens).
 *   - Upsert on the `token` unique constraint keeps re-registration idempotent —
 *     the same physical device re-registering (e.g. after reinstall) updates
 *     last_seen_at instead of erroring on the UNIQUE token constraint.
 *   - Free plugins only (no pro plugin deps).
 * SPORT: C-S6-T2
 */

import { gql } from 'urql';

/**
 * REGISTER_DEVICE_TOKEN — upsert an Expo push token for the current user.
 * on_conflict targets the `token` column's unique constraint (np_device_tokens_token_key).
 */
export const REGISTER_DEVICE_TOKEN = gql`
  mutation RegisterDeviceToken($token: String!, $platform: String!) {
    insert_np_device_tokens_one(
      object: { token: $token, platform: $platform }
      on_conflict: {
        constraint: np_device_tokens_token_key
        update_columns: [last_seen_at, platform]
      }
    ) {
      id
    }
  }
`;
