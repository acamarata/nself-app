// Purpose: Hasura Action handlers for ɳTasks list collaboration operations.
//   Invite lifecycle (create/accept/decline/revoke), share-link management,
//   member role management (updateRole/remove/leave/transferOwnership), and
//   presence upsert/remove.
//
// Inputs: Hasura Action payload; caller JWT in session_variables
// Outputs: operation-specific InviteResult / ShareLinkResult / MemberResult / PresenceResult
//
// Constraints:
//   - All mutations use HASURA_GRAPHQL_ADMIN_SECRET for DB writes (server-side only)
//   - Email sending stubs out gracefully when SMTP not configured (external gate)
//   - Sole-owner guard: leaveList + updateMemberRole + removeMember all block on sole owner
//   - Rate limiting enforced at nginx layer (invite_limit zone, 20/hour/JWT)
//   - Invite tokens are opaque 64-hex chars; share-link tokens are opaque 64-hex chars
//
// SPORT: F08 backend functions; L-S1-T1..T4, L-S2-T1..T2, L-S3-T1..T4, L-S4-T1..T2

import { Sentry } from './sentry';

const HASURA_URL   = process.env.HASURA_GRAPHQL_URL           || 'http://hasura:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET  || '';
const APP_BASE_URL = process.env.NTASK_APP_BASE_URL           || 'https://task.nself.org';
const SMTP_FROM    = process.env.SMTP_FROM_ADDRESS            || '';
const AUTH_URL     = process.env.HASURA_AUTH_URL              || 'http://auth:4000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

type InviteResult   = { success: boolean; inviteId?: string; message?: string };
type ShareLinkResult = { success: boolean; shareUrl?: string; token?: string; expiresAt?: string };
type MemberResult   = { success: boolean; message?: string };
type PresenceResult = { success: boolean };

// ---------------------------------------------------------------------------
// Admin GraphQL helper
// ---------------------------------------------------------------------------

async function adminQuery(
  query: string,
  variables: Record<string, unknown>
): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth helper: resolve email from user ID via admin query
// ---------------------------------------------------------------------------

async function getUserEmail(userId: string): Promise<string | null> {
  const result = await adminQuery(
    `query GetUserEmail($id: uuid!) { users_by_pk(id: $id) { email } }`,
    { id: userId }
  );
  const user = (result.data?.users_by_pk ?? null) as { email?: string } | null;
  return user?.email ?? null;
}

// ---------------------------------------------------------------------------
// Role guard: check caller is list owner or admin
// ---------------------------------------------------------------------------

async function requireOwnerOrAdmin(
  listId: string,
  userId: string,
  requiredRole: 'owner' | 'owner_or_admin' = 'owner_or_admin'
): Promise<{ allowed: boolean; role?: string }> {
  const result = await adminQuery(
    `query CheckRole($listId: uuid!, $userId: uuid!) {
      np_list_members(where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }) {
        role
      }
    }`,
    { listId, userId }
  );
  const members = (result.data?.np_list_members ?? []) as Array<{ role: string }>;
  const member  = members[0];
  if (!member) return { allowed: false };
  const roles = requiredRole === 'owner' ? ['owner'] : ['owner', 'admin'];
  return { allowed: roles.includes(member.role), role: member.role };
}

// ---------------------------------------------------------------------------
// Sole-owner guard
// ---------------------------------------------------------------------------

async function countOwners(listId: string): Promise<number> {
  const result = await adminQuery(
    `query CountOwners($listId: uuid!) {
      np_list_members_aggregate(where: { list_id: {_eq: $listId}, role: {_eq: "owner"} }) {
        aggregate { count }
      }
    }`,
    { listId }
  );
  return (result.data?.np_list_members_aggregate as { aggregate?: { count?: number } })?.aggregate?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Email sender stub — external gate if SMTP not configured
// ---------------------------------------------------------------------------

async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  listTitle: string;
  inviteToken: string;
  role: string;
}): Promise<{ sent: boolean; gate?: string }> {
  if (!SMTP_FROM) {
    // EXTERNAL GATE: hasura-auth SMTP relay not configured.
    // Set SMTP_FROM_ADDRESS + SMTP_* env vars in nself.yaml to enable.
    console.warn('[collab-ops] SMTP not configured — invite email not sent. EXTERNAL GATE: L-S1-EMAIL-SMTP');
    return { sent: false, gate: 'L-S1-EMAIL-SMTP: set SMTP_FROM_ADDRESS + SMTP_* in nself.yaml' };
  }

  const acceptUrl = `${APP_BASE_URL}/invite?token=${opts.inviteToken}`;

  // Send via hasura-auth email endpoint (which uses the configured SMTP relay)
  try {
    const res = await fetch(`${AUTH_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:       opts.to,
        from:     SMTP_FROM,
        subject:  `${opts.inviterName} invited you to "${opts.listTitle}" on ɳTasks`,
        template: 'list-invite',
        templateVars: {
          InviterName: opts.inviterName,
          ListTitle:   opts.listTitle,
          Role:        opts.role,
          Link:        acceptUrl,
        },
      }),
    });
    return { sent: res.ok };
  } catch (err) {
    Sentry.captureException(err);
    return { sent: false };
  }
}

// ===========================================================================
// L-S1: Invite lifecycle
// ===========================================================================

/** L-S1-T1: createListInvite */
export async function handleCreateListInvite(payload: HasuraActionPayload): Promise<InviteResult> {
  const userId  = payload.session_variables['x-hasura-user-id'];
  const { listId, email, role } = payload.input as { listId: string; email: string; role: string };

  if (!['owner', 'editor', 'viewer'].includes(role)) {
    return { success: false, message: 'Invalid role. Must be owner, editor, or viewer.' };
  }

  const { allowed } = await requireOwnerOrAdmin(listId, userId);
  if (!allowed) {
    return { success: false, message: 'Only list owners and admins can invite members.' };
  }

  // Upsert invite (ON CONFLICT: update token + status + role + expires_at to re-send)
  const inviteResult = await adminQuery(
    `mutation CreateInvite($listId: uuid!, $email: String!, $role: String!, $invitedBy: uuid!) {
      insert_np_list_invites_one(
        object: {
          list_id: $listId,
          invited_email: $email,
          role: $role,
          invited_by: $invitedBy,
          status: "pending"
        }
        on_conflict: {
          constraint: np_list_invites_list_id_invited_email_key,
          update_columns: [role, status, token, expires_at, updated_at]
        }
      ) { id token }
    }`,
    { listId, email, role, invitedBy: userId }
  );

  if (inviteResult.errors?.length) {
    Sentry.captureException(new Error(inviteResult.errors[0].message));
    return { success: false, message: 'Failed to create invite.' };
  }

  const invite = (inviteResult.data?.insert_np_list_invites_one ?? null) as { id: string; token: string } | null;
  if (!invite) return { success: false, message: 'Invite creation failed.' };

  // Fetch list title + inviter display name for the email
  const metaResult = await adminQuery(
    `query InviteMeta($listId: uuid!, $userId: uuid!) {
      np_lists_by_pk(id: $listId) { title }
      np_profiles(where: { id: {_eq: $userId} }) { display_name email }
    }`,
    { listId, userId }
  );
  const listTitle   = (metaResult.data?.np_lists_by_pk as { title?: string })?.title ?? 'a list';
  const profile     = ((metaResult.data?.np_profiles ?? []) as Array<{ display_name?: string; email?: string }>)[0];
  const inviterName = profile?.display_name ?? profile?.email ?? 'Someone';

  // Audit
  await adminQuery(
    `mutation AuditInvite($userId: uuid!, $meta: jsonb) {
      insert_np_account_activity_one(object: {
        user_id: $userId, action: "list_invite_sent", metadata: $meta
      }) { id }
    }`,
    { userId, meta: { listId, email, role, inviteId: invite.id } }
  );

  // Send email (non-blocking; stub if SMTP not configured)
  const emailResult = await sendInviteEmail({
    to: email, inviterName, listTitle, inviteToken: invite.token, role,
  });

  const message = emailResult.sent
    ? 'Invite sent successfully.'
    : `Invite created but email not sent. Gate: ${emailResult.gate ?? 'SMTP error'}`;

  return { success: true, inviteId: invite.id, message };
}

/** L-S1-T2: acceptListInvite */
export async function handleAcceptListInvite(payload: HasuraActionPayload): Promise<InviteResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { token } = payload.input as { token: string };

  const callerEmail = await getUserEmail(userId);
  if (!callerEmail) return { success: false, message: 'Could not resolve user email.' };

  // Fetch invite by token
  const invResult = await adminQuery(
    `query GetInvite($token: String!) {
      np_list_invites(where: { token: {_eq: $token} }) {
        id list_id invited_email role status expires_at
      }
    }`,
    { token }
  );
  const invite = ((invResult.data?.np_list_invites ?? []) as Array<{
    id: string; list_id: string; invited_email: string; role: string; status: string; expires_at: string;
  }>)[0];

  if (!invite) return { success: false, message: 'Invite not found.' };
  if (invite.invited_email.toLowerCase() !== callerEmail.toLowerCase()) {
    return { success: false, message: 'This invite was not sent to your email address.' };
  }
  if (invite.status !== 'pending') {
    return { success: false, message: `Invite is already ${invite.status}.` };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { success: false, message: 'Invite has expired.' };
  }

  // Map invite role to member role
  const memberRole = invite.role === 'editor' ? 'admin' : 'member';

  // Atomically: mark accepted, add member, link share record
  await adminQuery(
    `mutation AcceptInvite($id: uuid!, $userId: uuid!, $listId: uuid!, $role: String!, $memberRole: String!) {
      update_np_list_invites_by_pk(pk_columns: {id: $id}, _set: { status: "accepted" }) { id }
      insert_np_list_members_one(
        object: { list_id: $listId, user_id: $userId, role: $memberRole, added_by: $userId }
        on_conflict: { constraint: np_list_members_list_id_user_id_key, update_columns: [role] }
      ) { id }
      update_np_list_shares(
        where: { list_id: {_eq: $listId}, shared_with_email: {_ilike: $email} }
        _set: { shared_with_user_id: $userId, accepted_at: "now()" }
      ) { affected_rows }
    }`,
    { id: invite.id, userId, listId: invite.list_id, role: invite.role, memberRole, email: callerEmail }
  );

  return { success: true, inviteId: invite.id, message: 'You have joined the list.' };
}

/** L-S1-T3: declineListInvite */
export async function handleDeclineListInvite(payload: HasuraActionPayload): Promise<InviteResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { token } = payload.input as { token: string };

  const callerEmail = await getUserEmail(userId);
  if (!callerEmail) return { success: false, message: 'Could not resolve user email.' };

  const invResult = await adminQuery(
    `query GetInvite($token: String!) {
      np_list_invites(where: { token: {_eq: $token} }) { id invited_email status }
    }`,
    { token }
  );
  const invite = ((invResult.data?.np_list_invites ?? []) as Array<{
    id: string; invited_email: string; status: string;
  }>)[0];

  if (!invite) return { success: false, message: 'Invite not found.' };
  if (invite.invited_email.toLowerCase() !== callerEmail.toLowerCase()) {
    return { success: false, message: 'This invite was not sent to your email address.' };
  }
  if (invite.status !== 'pending') {
    return { success: false, message: `Invite is already ${invite.status}.` };
  }

  await adminQuery(
    `mutation DeclineInvite($id: uuid!) {
      update_np_list_invites_by_pk(pk_columns: {id: $id}, _set: { status: "declined" }) { id }
    }`,
    { id: invite.id }
  );

  return { success: true, inviteId: invite.id, message: 'Invite declined.' };
}

/** L-S1-T4: revokeListInvite */
export async function handleRevokeListInvite(payload: HasuraActionPayload): Promise<InviteResult> {
  const userId    = payload.session_variables['x-hasura-user-id'];
  const { inviteId } = payload.input as { inviteId: string };

  const invResult = await adminQuery(
    `query GetInvite($id: uuid!) {
      np_list_invites_by_pk(id: $id) { id list_id status }
    }`,
    { id: inviteId }
  );
  const invite = (invResult.data?.np_list_invites_by_pk ?? null) as {
    id: string; list_id: string; status: string;
  } | null;

  if (!invite) return { success: false, message: 'Invite not found.' };

  const { allowed } = await requireOwnerOrAdmin(invite.list_id, userId);
  if (!allowed) return { success: false, message: 'Only list owners and admins can revoke invites.' };

  if (invite.status !== 'pending') {
    return { success: false, message: `Invite is already ${invite.status}.` };
  }

  await adminQuery(
    `mutation RevokeInvite($id: uuid!) {
      update_np_list_invites_by_pk(pk_columns: {id: $id}, _set: { status: "revoked" }) { id }
    }`,
    { id: inviteId }
  );

  return { success: true, inviteId: inviteId, message: 'Invite revoked.' };
}

// ===========================================================================
// L-S2: Share links
// ===========================================================================

/** L-S2-T1: createShareLink */
export async function handleCreateShareLink(payload: HasuraActionPayload): Promise<ShareLinkResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId, permission, expiresInDays } = payload.input as {
    listId: string; permission: string; expiresInDays?: number;
  };

  if (!['owner', 'editor', 'viewer'].includes(permission)) {
    return { success: false, message: 'Invalid permission. Must be owner, editor, or viewer.' };
  }

  const { allowed } = await requireOwnerOrAdmin(listId, userId);
  if (!allowed) return { success: false, message: 'Only list owners and admins can create share links.' };

  const token    = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400_000).toISOString()
    : null;

  // Upsert share-link row (no specific email — share_with_email='__sharelink__' sentinel)
  const result = await adminQuery(
    `mutation UpsertShareLink($listId: uuid!, $token: String!, $perm: String!, $invitedBy: uuid!, $exp: timestamptz) {
      insert_np_list_shares_one(
        object: {
          list_id: $listId,
          shared_with_email: "__sharelink__",
          permission: $perm,
          invited_by: $invitedBy,
          token: $token,
          expires_at: $exp
        }
        on_conflict: {
          constraint: np_list_shares_list_id_shared_with_email_key,
          update_columns: [token, permission, expires_at, updated_at]
        }
      ) { id token }
    }`,
    { listId, token, perm: permission, invitedBy: userId, exp: expiresAt }
  );

  if (result.errors?.length) {
    Sentry.captureException(new Error(result.errors[0].message));
    return { success: false, message: 'Failed to create share link.' };
  }

  const share = (result.data?.insert_np_list_shares_one ?? null) as { id: string; token: string } | null;
  if (!share) return { success: false, message: 'Share link creation failed.' };

  const shareUrl = `${APP_BASE_URL}/shared/${share.token}`;
  return { success: true, shareUrl, token: share.token, expiresAt: expiresAt ?? undefined };
}

/** L-S2-T2: revokeShareLink */
export async function handleRevokeShareLink(payload: HasuraActionPayload): Promise<MemberResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId } = payload.input as { listId: string };

  const { allowed } = await requireOwnerOrAdmin(listId, userId);
  if (!allowed) return { success: false, message: 'Only list owners and admins can revoke share links.' };

  await adminQuery(
    `mutation RevokeShareLink($listId: uuid!) {
      update_np_list_shares(
        where: { list_id: {_eq: $listId}, shared_with_email: {_eq: "__sharelink__"} }
        _set: { token: null, expires_at: null }
      ) { affected_rows }
    }`,
    { listId }
  );

  return { success: true, message: 'Share link revoked.' };
}

// ===========================================================================
// L-S3: Member management
// ===========================================================================

/** L-S3-T1: updateMemberRole */
export async function handleUpdateMemberRole(payload: HasuraActionPayload): Promise<MemberResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId, userId: targetUserId, role } = payload.input as {
    listId: string; userId: string; role: string;
  };

  if (!['owner', 'admin', 'member'].includes(role)) {
    return { success: false, message: 'Invalid role. Must be owner, admin, or member.' };
  }

  const { allowed } = await requireOwnerOrAdmin(listId, userId, 'owner');
  if (!allowed) return { success: false, message: 'Only the list owner can change member roles.' };

  // Prevent demoting sole owner
  if (role !== 'owner') {
    const ownerCount = await countOwners(listId);
    const targetRole = await requireOwnerOrAdmin(listId, targetUserId, 'owner');
    if (targetRole.role === 'owner' && ownerCount <= 1) {
      return { success: false, message: 'Cannot demote the sole owner. Transfer ownership first.' };
    }
  }

  await adminQuery(
    `mutation UpdateRole($listId: uuid!, $userId: uuid!, $role: String!) {
      update_np_list_members(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }
        _set: { role: $role }
      ) { affected_rows }
    }`,
    { listId, userId: targetUserId, role }
  );

  return { success: true, message: `Member role updated to ${role}.` };
}

/** L-S3-T2: removeMember */
export async function handleRemoveMember(payload: HasuraActionPayload): Promise<MemberResult> {
  const callerId = payload.session_variables['x-hasura-user-id'];
  const { listId, userId: targetUserId } = payload.input as { listId: string; userId: string };

  const { allowed } = await requireOwnerOrAdmin(listId, callerId);
  if (!allowed) return { success: false, message: 'Only list owners and admins can remove members.' };

  // Cannot remove sole owner
  const ownerCount = await countOwners(listId);
  const targetCheck = await requireOwnerOrAdmin(listId, targetUserId, 'owner');
  if (targetCheck.role === 'owner' && ownerCount <= 1) {
    return { success: false, message: 'Cannot remove the sole owner. Transfer ownership first.' };
  }

  await adminQuery(
    `mutation RemoveMember($listId: uuid!, $userId: uuid!) {
      delete_np_list_members(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }
      ) { affected_rows }
      delete_np_list_shares(
        where: { list_id: {_eq: $listId}, shared_with_user_id: {_eq: $userId} }
      ) { affected_rows }
    }`,
    { listId, userId: targetUserId }
  );

  return { success: true, message: 'Member removed.' };
}

/** L-S3-T3: leaveList */
export async function handleLeaveList(payload: HasuraActionPayload): Promise<MemberResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId } = payload.input as { listId: string };

  // Block sole owner
  const ownerCount = await countOwners(listId);
  const { role } = await requireOwnerOrAdmin(listId, userId, 'owner');
  if (role === 'owner' && ownerCount <= 1) {
    return {
      success: false,
      message: 'You are the sole owner. Transfer ownership before leaving.',
    };
  }

  await adminQuery(
    `mutation LeaveList($listId: uuid!, $userId: uuid!) {
      delete_np_list_members(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }
      ) { affected_rows }
      delete_np_list_shares(
        where: { list_id: {_eq: $listId}, shared_with_user_id: {_eq: $userId} }
      ) { affected_rows }
    }`,
    { listId, userId }
  );

  return { success: true, message: 'You have left the list.' };
}

/** L-S3-T4: transferOwnership */
export async function handleTransferOwnership(payload: HasuraActionPayload): Promise<MemberResult> {
  const callerId = payload.session_variables['x-hasura-user-id'];
  const { listId, newOwnerId } = payload.input as { listId: string; newOwnerId: string };

  const { allowed, role } = await requireOwnerOrAdmin(listId, callerId, 'owner');
  if (!allowed || role !== 'owner') {
    return { success: false, message: 'Only the current list owner can transfer ownership.' };
  }
  if (callerId === newOwnerId) {
    return { success: false, message: 'You are already the owner.' };
  }

  // Verify new owner is a member
  const memberCheck = await adminQuery(
    `query CheckMember($listId: uuid!, $userId: uuid!) {
      np_list_members(where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }) { id role }
    }`,
    { listId, userId: newOwnerId }
  );
  const newOwnerMember = ((memberCheck.data?.np_list_members ?? []) as Array<{ id: string; role: string }>)[0];
  if (!newOwnerMember) {
    return { success: false, message: 'Target user is not a member of this list.' };
  }

  // Atomic: demote current owner → editor, promote new owner → owner
  await adminQuery(
    `mutation TransferOwnership($listId: uuid!, $oldOwnerId: uuid!, $newOwnerId: uuid!) {
      demote: update_np_list_members(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $oldOwnerId} }
        _set: { role: "admin" }
      ) { affected_rows }
      promote: update_np_list_members(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $newOwnerId} }
        _set: { role: "owner" }
      ) { affected_rows }
    }`,
    { listId, oldOwnerId: callerId, newOwnerId }
  );

  return { success: true, message: 'Ownership transferred.' };
}

// ===========================================================================
// L-S4: Presence
// ===========================================================================

/** L-S4-T1: upsertPresence */
export async function handleUpsertPresence(payload: HasuraActionPayload): Promise<PresenceResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId, status, editingTodoId } = payload.input as {
    listId: string; status: string; editingTodoId?: string;
  };

  if (!['viewing', 'editing'].includes(status)) {
    return { success: false };
  }

  await adminQuery(
    `mutation UpsertPresence($listId: uuid!, $userId: uuid!, $status: String!, $editingTodoId: uuid) {
      insert_np_list_presence_one(
        object: {
          list_id: $listId,
          user_id: $userId,
          status: $status,
          editing_todo_id: $editingTodoId,
          last_seen_at: "now()"
        }
        on_conflict: {
          constraint: np_list_presence_list_id_user_id_key,
          update_columns: [status, editing_todo_id, last_seen_at]
        }
      ) { id }
    }`,
    { listId, userId, status, editingTodoId: editingTodoId ?? null }
  );

  return { success: true };
}

/** L-S4-T2: removePresence */
export async function handleRemovePresence(payload: HasuraActionPayload): Promise<PresenceResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  const { listId } = payload.input as { listId: string };

  await adminQuery(
    `mutation RemovePresence($listId: uuid!, $userId: uuid!) {
      delete_np_list_presence(
        where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }
      ) { affected_rows }
    }`,
    { listId, userId }
  );

  return { success: true };
}

// ===========================================================================
// Router — called by the express/Hono router in functions/index.ts
// ===========================================================================

export const COLLAB_ROUTES: Record<string, (p: HasuraActionPayload) => Promise<unknown>> = {
  '/api/actions/invite-create':            handleCreateListInvite,
  '/api/actions/invite-accept':            handleAcceptListInvite,
  '/api/actions/invite-decline':           handleDeclineListInvite,
  '/api/actions/invite-revoke':            handleRevokeListInvite,
  '/api/actions/share-create':             handleCreateShareLink,
  '/api/actions/share-revoke':             handleRevokeShareLink,
  '/api/actions/member-role-update':       handleUpdateMemberRole,
  '/api/actions/member-remove':            handleRemoveMember,
  '/api/actions/list-leave':               handleLeaveList,
  '/api/actions/list-transfer-ownership':  handleTransferOwnership,
  '/api/actions/presence-upsert':          handleUpsertPresence,
  '/api/actions/presence-remove':          handleRemovePresence,
};
