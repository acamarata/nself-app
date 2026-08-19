/**
 * graphql-account.ts — Hasura Action wrappers for account security (Epic J).
 * Purpose: MFA enroll/disable and session list/revoke, called via the same
 *          /api/graphql cookie-auth proxy as every other GraphQL op in this app.
 *          Mirrors apps/mobile/src/lib/accountOps.ts (urql gql tags) but using
 *          this app's gql() HTTP client and Hasura's actual custom_types
 *          (see backend/hasura/metadata/actions.yaml — Session/MfaResult).
 *          getMfaStatus queries public.task_users.mfa_enabled directly (a
 *          plain table select, not an Action) — the server-side mirror of
 *          MFA state added in migration 027; role `user` is filtered to its
 *          own row via X-Hasura-User-Id, so no id argument is needed.
 * Inputs: None (session-scoped) or otp/method/sessionId strings.
 * Outputs: Typed result objects; false/null on error (never throws).
 * Constraints: Not yet promoted to @nself/ntask-core (account actions are
 *              server-side Hasura Actions, not table CRUD ops).
 * SPORT: J-S2 (changeEmail/changePassword parity), J-S2 aux (MFA/sessions).
 */
import { gql } from './api';

export interface AccountSession {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EnableMfaResult {
  success: boolean;
  totpSecret: string | null;
  qrCodeUrl: string | null;
  message: string | null;
}

// enableMfa takes no arguments (backend/hasura/metadata/actions.graphql) —
// TOTP is the only supported method today.
const ENABLE_MFA = /* GraphQL */`
  mutation EnableMfa {
    enableMfa {
      success
      totpSecret
      qrCodeUrl
      message
    }
  }
`;

const DISABLE_MFA = /* GraphQL */`
  mutation DisableMfa($otp: String!) {
    disableMfa(otp: $otp) {
      success
      message
    }
  }
`;

const LIST_SESSIONS = /* GraphQL */`
  query ListSessions {
    listSessions {
      sessions {
        id
        createdAt
        updatedAt
      }
    }
  }
`;

const REVOKE_SESSION = /* GraphQL */`
  mutation RevokeSession($sessionId: String!) {
    revokeSession(sessionId: $sessionId) {
      success
    }
  }
`;

// task_users is filtered to the caller's own row by Hasura's select_permissions
// (user_id: { _eq: X-Hasura-User-Id }), so no id argument is required.
const GET_MFA_STATUS = /* GraphQL */`
  query GetMfaStatus {
    task_users {
      mfa_enabled
    }
  }
`;

export async function enableMfa(): Promise<EnableMfaResult | null> {
  const res = await gql<{ enableMfa: EnableMfaResult }>(ENABLE_MFA);
  if (res.error || !res.data) return null;
  return res.data.enableMfa;
}

export async function disableMfa(otp: string): Promise<boolean> {
  const res = await gql<{ disableMfa: { success: boolean } }>(DISABLE_MFA, { otp });
  return !res.error && !!res.data?.disableMfa.success;
}

export async function listSessions(): Promise<AccountSession[]> {
  const res = await gql<{ listSessions: { sessions: AccountSession[] } }>(LIST_SESSIONS);
  if (res.error || !res.data) return [];
  return res.data.listSessions.sessions;
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  const res = await gql<{ revokeSession: { success: boolean } }>(REVOKE_SESSION, { sessionId });
  return !res.error && !!res.data?.revokeSession.success;
}

export async function getMfaStatus(): Promise<boolean> {
  const res = await gql<{ task_users: Array<{ mfa_enabled: boolean }> }>(GET_MFA_STATUS);
  if (res.error || !res.data) return false;
  return res.data.task_users[0]?.mfa_enabled ?? false;
}
