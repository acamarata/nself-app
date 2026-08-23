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
import { adminGql } from './lib/admin-gql';
import { unauthorized } from './lib/action-error';
import { readFile } from 'node:fs/promises';
import { sendMail, renderTemplate } from './lib/mailer';
import type { MailTransport, MailerConfig } from './lib/mailer';

const APP_BASE_URL = process.env.NTASK_APP_BASE_URL           || 'https://task.nself.org';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

type InviteResult   = { success: boolean; inviteId?: string; message?: string };
type ShareLinkResult = { success: boolean; shareUrl?: string; token?: string; expiresAt?: string; message?: string };
type MemberResult   = { success: boolean; message?: string };
type PresenceResult = { success: boolean };

// ---------------------------------------------------------------------------
// Admin GraphQL access
// ---------------------------------------------------------------------------
// Provided by lib/admin-gql, shared with every other handler. It returns the
// `data` payload and throws on the HTTP-200 `{ errors: [...] }` bodies that the
// local helper here used to hand back as an ordinary result — callers read
// `result.x`, got undefined, and carried on as if the write had landed.

// ---------------------------------------------------------------------------
// Auth helper: resolve email from user ID via admin query
// ---------------------------------------------------------------------------

/**
 * ROOT FIELD: `user`, not `users_by_pk`. hasura-auth applies its own table
 * configuration to the auth schema on every startup, renaming auth.users'
 * select_by_pk root field to `user`. The previous `users_by_pk` selection did not
 * exist in query_root, so this threw "field 'users_by_pk' not found" on every
 * call — every invite that needed the inviter's address failed. Verified by
 * introspecting the running instance (2026-08-16).
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const result = await adminGql<{ user: { email?: string } | null }>(
    `query GetUserEmail($id: uuid!) { user(id: $id) { email } }`,
    { id: userId }
  );
  return result.user?.email ?? null;
}

// ---------------------------------------------------------------------------
// Role guard: check caller is list owner or admin
// ---------------------------------------------------------------------------

async function requireOwnerOrAdmin(
  listId: string,
  userId: string,
  requiredRole: 'owner' | 'owner_or_admin' = 'owner_or_admin'
): Promise<{ allowed: boolean; role?: string }> {
  const result = await adminGql<{ np_list_members: Array<{ role: string }> }>(
    `query CheckRole($listId: uuid!, $userId: uuid!) {
      np_list_members(where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }) {
        role
      }
    }`,
    { listId, userId }
  );
  const members = result.np_list_members ?? [];
  const member  = members[0];
  if (!member) return { allowed: false };
  const roles = requiredRole === 'owner' ? ['owner'] : ['owner', 'admin'];
  return { allowed: roles.includes(member.role), role: member.role };
}

// ---------------------------------------------------------------------------
// Sole-owner guard
// ---------------------------------------------------------------------------

async function countOwners(listId: string): Promise<number> {
  const result = await adminGql<{
    np_list_members_aggregate: { aggregate?: { count?: number } } | null;
  }>(
    `query CountOwners($listId: uuid!) {
      np_list_members_aggregate(where: { list_id: {_eq: $listId}, role: {_eq: "owner"} }) {
        aggregate { count }
      }
    }`,
    { listId }
  );
  return result.np_list_members_aggregate?.aggregate?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Invite email
//
// Sent over SMTP by this service. The previous version POSTed to a hasura-auth
// send-email route that does not exist (live probe answered 404
// route-not-found) and discarded the failure, so invite mail was dead in every
// environment while the action reported success. hasura-auth sends only its own
// mail and exposes no relay for ours.
// ---------------------------------------------------------------------------

// The templates sit next to this service in the repo (backend/email-templates)
// but the deployed container mounts only backend/functions at /opt/project, so
// the repo-relative path resolves to nothing there. Rather than guess one
// layout, try the layouts that exist and let NTASK_EMAIL_TEMPLATES_PATH override
// both. Guessing one is how the deployed invite email reported
// "template unreadable" while the file sat one directory up on the host.
function templateCandidates(name: string): URL[] {
  const configured = process.env['NTASK_EMAIL_TEMPLATES_PATH'];
  const candidates: URL[] = [];
  if (configured) {
    candidates.push(new URL(`${configured.replace(/\/$/, '')}/${name}`, 'file:///'));
  }
  // Mounted alongside the code inside the container.
  candidates.push(new URL(`./email-templates/${name}`, import.meta.url));
  // Repo layout: backend/functions/../email-templates.
  candidates.push(new URL(`../email-templates/${name}`, import.meta.url));
  return candidates;
}

let inviteTemplate: string | null = null;

/** Read once. A missing template is a deployment fault, not a per-send cost. */
async function loadInviteTemplate(): Promise<string> {
  if (inviteTemplate !== null) return inviteTemplate;
  const tried: string[] = [];
  for (const url of templateCandidates('list-invite.html')) {
    try {
      inviteTemplate = await readFile(url, 'utf8');
      return inviteTemplate;
    } catch {
      tried.push(url.pathname);
    }
  }
  throw new Error(`list-invite.html not found; looked in ${tried.join(', ')}`);
}

export async function sendInviteEmail(
  opts: {
    to: string;
    inviterName: string;
    listTitle: string;
    inviteToken: string;
    role: string;
  },
  deps: { transport?: MailTransport; config?: MailerConfig | null } = {},
): Promise<{ sent: boolean; gate?: string }> {
  const acceptUrl = `${APP_BASE_URL}/invite?token=${opts.inviteToken}`;

  let html: string;
  try {
    html = renderTemplate(await loadInviteTemplate(), {
      InviterName: opts.inviterName,
      ListTitle:   opts.listTitle,
      Role:        opts.role,
      Link:        acceptUrl,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'collab-ops', step: 'invite-template' } });
    return { sent: false, gate: `invite template unreadable: ${(err as Error).message}` };
  }

  const result = await sendMail(
    {
      to: opts.to,
      subject: `${opts.inviterName} invited you to "${opts.listTitle}" on ɳTasks`,
      html,
      text: `${opts.inviterName} invited you to "${opts.listTitle}" as ${opts.role}. Accept: ${acceptUrl}`,
    },
    deps,
  );

  if (!result.sent) {
    // Logged as well as returned: the action result reaches the user, this
    // reaches whoever runs the stack.
    console.warn(`[collab-ops] invite email not sent to ${opts.to}: ${result.gate}`);
  }
  return result;
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
  let inviteResult: { insert_np_list_invites_one?: unknown };
  try {
    inviteResult = await adminGql<{ insert_np_list_invites_one?: unknown }>(
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
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'collab-ops', op: 'createListInvite' } });
    return { success: false, message: 'Failed to create invite.' };
  }

  const invite = (inviteResult.insert_np_list_invites_one ?? null) as { id: string; token: string } | null;
  if (!invite) return { success: false, message: 'Invite creation failed.' };

  // Fetch list title + inviter display name for the email. Cosmetic — fall back
  // to generic copy rather than sinking an invite that has already been created.
  let listTitle = 'a list';
  let inviterName = 'Someone';
  try {
    const metaResult = await adminGql<{
      np_lists_by_pk: { title?: string } | null;
      np_profiles: Array<{ display_name?: string; email?: string }>;
    }>(
      `query InviteMeta($listId: uuid!, $userId: uuid!) {
        np_lists_by_pk(id: $listId) { title }
        np_profiles(where: { id: {_eq: $userId} }) { display_name email }
      }`,
      { listId, userId }
    );
    listTitle = metaResult.np_lists_by_pk?.title ?? listTitle;
    const profile = (metaResult.np_profiles ?? [])[0];
    inviterName = profile?.display_name || profile?.email || inviterName;
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'collab-ops', op: 'createListInvite', step: 'meta' } });
  }

  // Audit — best effort; the invite already exists.
  try {
    await adminGql(
      `mutation AuditInvite($userId: uuid!, $meta: jsonb) {
        insert_np_account_activity_one(object: {
          user_id: $userId, action: "list_invite_sent", metadata: $meta
        }) { id }
      }`,
      { userId, meta: { listId, email, role, inviteId: invite.id } }
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'collab-ops', op: 'createListInvite', step: 'audit' } });
  }

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
  const invResult = await adminGql<{
    np_list_invites: Array<{
      id: string; list_id: string; invited_email: string; role: string; status: string; expires_at: string;
    }>;
  }>(
    `query GetInvite($token: String!) {
      np_list_invites(where: { token: {_eq: $token} }) {
        id list_id invited_email role status expires_at
      }
    }`,
    { token }
  );
  const invite = (invResult.np_list_invites ?? [])[0];

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
  await adminGql(
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

  const invResult = await adminGql<{
    np_list_invites: Array<{ id: string; invited_email: string; status: string }>;
  }>(
    `query GetInvite($token: String!) {
      np_list_invites(where: { token: {_eq: $token} }) { id invited_email status }
    }`,
    { token }
  );
  const invite = (invResult.np_list_invites ?? [])[0];

  if (!invite) return { success: false, message: 'Invite not found.' };
  if (invite.invited_email.toLowerCase() !== callerEmail.toLowerCase()) {
    return { success: false, message: 'This invite was not sent to your email address.' };
  }
  if (invite.status !== 'pending') {
    return { success: false, message: `Invite is already ${invite.status}.` };
  }

  await adminGql(
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

  const invResult = await adminGql<{
    np_list_invites_by_pk: { id: string; list_id: string; status: string } | null;
  }>(
    `query GetInvite($id: uuid!) {
      np_list_invites_by_pk(id: $id) { id list_id status }
    }`,
    { id: inviteId }
  );
  const invite = invResult.np_list_invites_by_pk ?? null;

  if (!invite) return { success: false, message: 'Invite not found.' };

  const { allowed } = await requireOwnerOrAdmin(invite.list_id, userId);
  if (!allowed) return { success: false, message: 'Only list owners and admins can revoke invites.' };

  if (invite.status !== 'pending') {
    return { success: false, message: `Invite is already ${invite.status}.` };
  }

  await adminGql(
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
  let result: { insert_np_list_shares_one?: unknown };
  try {
    result = await adminGql<{ insert_np_list_shares_one?: unknown }>(
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
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'collab-ops', op: 'createShareLink' } });
    return { success: false, message: 'Failed to create share link.' };
  }

  const share = (result.insert_np_list_shares_one ?? null) as { id: string; token: string } | null;
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

  await adminGql(
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

  await adminGql(
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

  await adminGql(
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

  await adminGql(
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
  const memberCheck = await adminGql<{ np_list_members: Array<{ id: string; role: string }> }>(
    `query CheckMember($listId: uuid!, $userId: uuid!) {
      np_list_members(where: { list_id: {_eq: $listId}, user_id: {_eq: $userId} }) { id role }
    }`,
    { listId, userId: newOwnerId }
  );
  const newOwnerMember = (memberCheck.np_list_members ?? [])[0];
  if (!newOwnerMember) {
    return { success: false, message: 'Target user is not a member of this list.' };
  }

  // Atomic: demote current owner → editor, promote new owner → owner
  await adminGql(
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

  await adminGql(
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

  await adminGql(
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
