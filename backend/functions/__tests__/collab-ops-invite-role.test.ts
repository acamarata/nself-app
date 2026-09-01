/**
 * Purpose: Cover the invite-role -> member-role mapping in
 *   handleAcceptListInvite (collab-ops.ts). Regression test for the privilege
 *   escalation where an 'editor' invite silently became an 'admin' member,
 *   which carries approval authority and member management the invitee was
 *   never granted (incident 2026-08-31).
 *
 * Invite vocabulary:  owner | editor | viewer          (np_list_invites CHECK)
 * Member vocabulary:  owner | admin | editor | member  (np_list_members CHECK,
 *   widened in migration 032_np_list_members_add_editor_role.sql)
 *
 * Expected mapping after the fix:
 *   owner  -> owner   (honest 1:1 match; np_list_members allows multiple owners)
 *   editor -> editor  (dedicated role added in migration 032; must NOT become admin)
 *   viewer -> member  (unchanged)
 *
 * global.fetch is stubbed for the whole module because adminGql() is called
 * without an injectable fetchImpl from these call sites — this test asserts
 * on the `memberRole` variable of the AcceptInvite mutation, keyed off the
 * GraphQL operation name in each request body.
 *
 * SPORT: F08 backend functions — L-S1-T2 acceptListInvite.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleAcceptListInvite } from '../collab-ops.js';

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

/**
 * Stub global.fetch to answer each Hasura operation by name, and record the
 * variables sent with the AcceptInvite mutation so the test can assert on
 * the computed memberRole.
 */
function stubHasura(inviteRole: string) {
  const acceptCalls: Array<Record<string, unknown>> = [];

  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> };
    const op = /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(body.query)?.[1];

    let data: Record<string, unknown>;
    switch (op) {
      case 'GetUserEmail':
        data = { user: { email: 'invitee@example.com' } };
        break;
      case 'GetInvite':
        data = {
          np_list_invites: [
            {
              id: 'invite-1',
              list_id: 'list-1',
              invited_email: 'invitee@example.com',
              role: inviteRole,
              status: 'pending',
              expires_at: FUTURE,
            },
          ],
        };
        break;
      case 'AcceptInvite':
        acceptCalls.push(body.variables);
        data = {
          update_np_list_invites_by_pk: { id: 'invite-1' },
          insert_np_list_members_one: { id: 'member-1' },
          update_np_list_shares: { affected_rows: 0 },
        };
        break;
      default:
        throw new Error(`stubHasura: unexpected operation ${op ?? '(unnamed)'}`);
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data }),
    };
  }) as unknown as typeof fetch;

  return { fetchImpl, acceptCalls };
}

function payloadFor(token: string) {
  return {
    action: { name: 'acceptListInvite' },
    session_variables: { 'x-hasura-user-id': 'user-1' },
    input: { token },
  };
}

let originalFetch: typeof fetch;

describe('handleAcceptListInvite: invite role -> member role mapping', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("'owner' invite becomes an 'owner' member", async () => {
    const { fetchImpl, acceptCalls } = stubHasura('owner');
    globalThis.fetch = fetchImpl;

    const result = await handleAcceptListInvite(payloadFor('tok-owner'));

    assert.equal(result.success, true);
    assert.equal(acceptCalls.length, 1);
    assert.equal(acceptCalls[0]!['memberRole'], 'owner');
  });

  test("'editor' invite becomes an 'editor' member — must NOT become admin or member", async () => {
    const { fetchImpl, acceptCalls } = stubHasura('editor');
    globalThis.fetch = fetchImpl;

    const result = await handleAcceptListInvite(payloadFor('tok-editor'));

    assert.equal(result.success, true);
    assert.equal(acceptCalls.length, 1);
    assert.equal(acceptCalls[0]!['memberRole'], 'editor');
    assert.notEqual(acceptCalls[0]!['memberRole'], 'admin');
    assert.notEqual(acceptCalls[0]!['memberRole'], 'member');
  });

  test("'viewer' invite becomes a 'member'", async () => {
    const { fetchImpl, acceptCalls } = stubHasura('viewer');
    globalThis.fetch = fetchImpl;

    const result = await handleAcceptListInvite(payloadFor('tok-viewer'));

    assert.equal(result.success, true);
    assert.equal(acceptCalls.length, 1);
    assert.equal(acceptCalls[0]!['memberRole'], 'member');
  });
});
