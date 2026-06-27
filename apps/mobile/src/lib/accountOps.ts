/**
 * Purpose: GraphQL operations for Epic J account/legal Hasura actions.
 *   Defined inline (not in ntask-core yet) — to be promoted once stable.
 * Inputs: None (operations are gql template literals consumed by urql).
 * Outputs: TypedDocumentNode-compatible gql strings for all account lifecycle ops.
 * Constraints: Free plugins only. Hasura actions follow { actionName { fields } } shape.
 *   Never reference pro plugins. No version bump without an approved Release Plan.
 * SPORT: P5-J-account-ops
 */

import { gql } from 'urql';

// ---------------------------------------------------------------------------
// Account lifecycle
// ---------------------------------------------------------------------------

/**
 * Permanently deletes the authenticated user's account and all associated data.
 * Irreversible — UI must require explicit confirmation before calling.
 */
export const DELETE_MY_ACCOUNT = gql`
  mutation DeleteMyAccount {
    deleteMyAccount {
      success
      message
    }
  }
`;

/**
 * Enqueues an async GDPR/CCPA data export job.
 * Returns a jobId the client can poll and a requestedAt timestamp.
 */
export const REQUEST_DATA_EXPORT = gql`
  mutation RequestDataExport {
    requestDataExport {
      jobId
      requestedAt
    }
  }
`;

// ---------------------------------------------------------------------------
// Credential changes
// ---------------------------------------------------------------------------

/**
 * Initiates an email-change flow for the authenticated user.
 * The backend sends a verification link to $newEmail before committing the change.
 */
export const CHANGE_EMAIL = gql`
  mutation ChangeEmail($newEmail: String!) {
    changeEmail(newEmail: $newEmail) {
      success
    }
  }
`;

/**
 * Changes the authenticated user's password.
 * Requires the current password for re-authentication before accepting the new one.
 */
export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(
      currentPassword: $currentPassword
      newPassword: $newPassword
    ) {
      success
    }
  }
`;

// ---------------------------------------------------------------------------
// MFA
// ---------------------------------------------------------------------------

/**
 * Begins MFA enrollment for $method ("totp" or "sms").
 * Returns a TOTP secret + QR code URL for TOTP; for SMS the secret is the masked number.
 * The user must complete verification (CONFIRM_MFA or first TOTP use) to activate.
 */
export const ENABLE_MFA = gql`
  mutation EnableMfa($method: String!) {
    enableMfa(method: $method) {
      secret
      qrCodeUrl
    }
  }
`;

/**
 * Disables MFA for the authenticated user after verifying a current OTP code.
 */
export const DISABLE_MFA = gql`
  mutation DisableMfa($otp: String!) {
    disableMfa(otp: $otp) {
      success
    }
  }
`;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Returns all active sessions for the authenticated user.
 * isCurrent marks the session that issued this request.
 */
export const LIST_SESSIONS = gql`
  query ListSessions {
    listSessions {
      id
      deviceName
      lastSeenAt
      createdAt
      isCurrent
    }
  }
`;

/**
 * Revokes a specific session by its UUID, immediately invalidating that token.
 * Cannot revoke the current session — use logout for that.
 */
export const REVOKE_SESSION = gql`
  mutation RevokeSession($sessionId: uuid!) {
    revokeSession(sessionId: $sessionId) {
      success
    }
  }
`;

// ---------------------------------------------------------------------------
// Result types (mirrors Hasura action return shapes)
// ---------------------------------------------------------------------------

export interface DeleteMyAccountResult {
  deleteMyAccount: {
    success: boolean;
    message: string | null;
  };
}

export interface RequestDataExportResult {
  requestDataExport: {
    jobId: string;
    requestedAt: string;
  };
}

export interface ChangeEmailResult {
  changeEmail: {
    success: boolean;
  };
}

export interface ChangePasswordResult {
  changePassword: {
    success: boolean;
  };
}

export interface EnableMfaResult {
  enableMfa: {
    secret: string;
    qrCodeUrl: string;
  };
}

export interface DisableMfaResult {
  disableMfa: {
    success: boolean;
  };
}

export interface Session {
  id: string;
  deviceName: string | null;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface ListSessionsResult {
  listSessions: Session[];
}

export interface RevokeSessionResult {
  revokeSession: {
    success: boolean;
  };
}
