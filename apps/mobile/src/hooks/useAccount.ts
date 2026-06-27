/**
 * Purpose: React hooks for account lifecycle operations (Epic J).
 *   Wraps urql mutations/queries for delete-account, data-export, credential
 *   changes, MFA, and session management.
 * Inputs: User-supplied values (newEmail, passwords, OTP, sessionId).
 * Outputs: Typed result objects or thrown errors; refetch function for sessions.
 * Constraints: All operations are Hasura actions — no direct table writes.
 *   Free plugins only. Throws on urql error so callers can surface UI feedback.
 * SPORT: P5-J-account-ops
 */

import { useMutation, useQuery } from 'urql';
import {
  DELETE_MY_ACCOUNT,
  REQUEST_DATA_EXPORT,
  CHANGE_EMAIL,
  CHANGE_PASSWORD,
  ENABLE_MFA,
  DISABLE_MFA,
  LIST_SESSIONS,
  REVOKE_SESSION,
  type DeleteMyAccountResult,
  type RequestDataExportResult,
  type ChangeEmailResult,
  type ChangePasswordResult,
  type EnableMfaResult,
  type DisableMfaResult,
  type ListSessionsResult,
  type RevokeSessionResult,
  type Session,
} from '../lib/accountOps';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Unwraps an urql OperationResult, throwing a descriptive Error on failure.
 * Keeps mutation callers concise — no repeated error-checking boilerplate.
 */
function unwrap<T>(result: { data?: T; error?: { message: string } }, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error(`${label}: no data returned`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// useAccountMutations
// ---------------------------------------------------------------------------

/**
 * Returns callable async functions for all account lifecycle mutations.
 * Each function executes the mutation and returns the unwrapped payload or throws.
 */
export function useAccountMutations() {
  const [, execDeleteAccount]    = useMutation<DeleteMyAccountResult>(DELETE_MY_ACCOUNT);
  const [, execDataExport]       = useMutation<RequestDataExportResult>(REQUEST_DATA_EXPORT);
  const [, execChangeEmail]      = useMutation<ChangeEmailResult>(CHANGE_EMAIL);
  const [, execChangePassword]   = useMutation<ChangePasswordResult>(CHANGE_PASSWORD);
  const [, execEnableMfa]        = useMutation<EnableMfaResult>(ENABLE_MFA);
  const [, execDisableMfa]       = useMutation<DisableMfaResult>(DISABLE_MFA);
  const [, execRevokeSession]    = useMutation<RevokeSessionResult>(REVOKE_SESSION);

  /**
   * Permanently deletes the authenticated account and all user data.
   * UI must gate this behind an explicit confirmation step.
   */
  async function deleteAccount(): Promise<{ success: boolean; message?: string }> {
    const result = await execDeleteAccount({});
    const data = unwrap(result, 'deleteAccount');
    return {
      success: data.deleteMyAccount.success,
      message: data.deleteMyAccount.message ?? undefined,
    };
  }

  /**
   * Enqueues a GDPR/CCPA data export job.
   * The user will receive an email when the export archive is ready.
   */
  async function requestDataExport(): Promise<{ jobId: string; requestedAt: string }> {
    const result = await execDataExport({});
    const data = unwrap(result, 'requestDataExport');
    return data.requestDataExport;
  }

  /**
   * Starts an email-change flow. The backend sends a verification link to newEmail.
   */
  async function changeEmail(newEmail: string): Promise<{ success: boolean }> {
    const result = await execChangeEmail({ newEmail });
    const data = unwrap(result, 'changeEmail');
    return data.changeEmail;
  }

  /**
   * Changes the password. currentPassword is used to re-authenticate before
   * the new password is accepted.
   */
  async function changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const result = await execChangePassword({ currentPassword, newPassword });
    const data = unwrap(result, 'changePassword');
    return data.changePassword;
  }

  /**
   * Begins MFA enrollment.
   * method: "totp" | "sms"
   * Returns the TOTP secret and a QR code URL to display in the enrollment UI.
   * MFA is not active until the user completes the verification step.
   */
  async function enableMfa(method: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const result = await execEnableMfa({ method });
    const data = unwrap(result, 'enableMfa');
    return data.enableMfa;
  }

  /**
   * Disables MFA after verifying the current OTP code.
   */
  async function disableMfa(otp: string): Promise<{ success: boolean }> {
    const result = await execDisableMfa({ otp });
    const data = unwrap(result, 'disableMfa');
    return data.disableMfa;
  }

  /**
   * Revokes a session by its UUID, immediately invalidating that token.
   * Cannot be used to revoke the caller's own current session.
   */
  async function revokeSession(sessionId: string): Promise<{ success: boolean }> {
    const result = await execRevokeSession({ sessionId });
    const data = unwrap(result, 'revokeSession');
    return data.revokeSession;
  }

  return {
    deleteAccount,
    requestDataExport,
    changeEmail,
    changePassword,
    enableMfa,
    disableMfa,
    revokeSession,
  };
}

// ---------------------------------------------------------------------------
// useSessions
// ---------------------------------------------------------------------------

export interface UseSessionsResult {
  sessions: Session[];
  fetching: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Fetches all active sessions for the authenticated user.
 * isCurrent marks the session making this request.
 * Call refetch() after revokeSession() to update the list.
 */
export function useSessions(): UseSessionsResult {
  const [result, reexecute] = useQuery<ListSessionsResult>({
    query: LIST_SESSIONS,
  });

  return {
    sessions: result.data?.listSessions ?? [],
    fetching: result.fetching,
    error: result.error ? new Error(result.error.message) : undefined,
    refetch: () => reexecute({ requestPolicy: 'network-only' }),
  };
}
