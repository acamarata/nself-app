// Purpose: Seed local ɳTask backend with demo users, lists, todos, and shares.
//   Talks to the real nSelf stack — nSelf Auth (hasura-auth) for user accounts
//   and Hasura GraphQL (admin) for np_* table data. No Supabase.
// Inputs: backend/.env.dev (HASURA_GRAPHQL_ADMIN_SECRET; optional URL overrides).
// Outputs: np_lists / np_todos / np_list_shares rows + auth users; logs a summary.
// Constraints:
//   - Idempotent: re-running reuses existing users/lists/todos/shares (query-then-insert).
//   - Admin-only: uses x-hasura-admin-secret, so it bypasses row permissions. Never
//     run against a non-local backend.
//   - Requires Node 18+ (global fetch).
// SPORT: backend seed tooling (np_lists, np_todos, np_list_shares).

import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.dev') });

// ── Connection config (host-side defaults; container hostnames overridden) ───
const HASURA_URL =
  process.env.HASURA_GRAPHQL_URL_HOST || 'http://localhost:8080/v1/graphql';
const AUTH_URL =
  process.env.AUTH_SERVER_URL || process.env.NSELF_AUTH_URL || 'http://localhost:4000';
const ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET || process.env.HASURA_ADMIN_SECRET || '';

if (!ADMIN_SECRET) {
  console.error(
    'Missing HASURA_GRAPHQL_ADMIN_SECRET in backend/.env.dev — cannot seed.'
  );
  process.exit(1);
}

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_USERS = [
  { email: 'owner@nself.org', password: 'password', displayName: 'System Owner', role: 'owner' },
  { email: 'admin@nself.org', password: 'password', displayName: 'Administrator', role: 'admin' },
  { email: 'user@nself.org', password: 'password', displayName: 'Demo User', role: 'user' },
];

const SAMPLE_LISTS: Record<
  string,
  { title: string; description: string; color: string; is_default: boolean }[]
> = {
  'owner@nself.org': [
    { title: 'Getting Started', description: 'Welcome tasks and initial setup', color: '#6366f1', is_default: true },
    { title: 'Work Tasks', description: 'System administration and configuration', color: '#8b5cf6', is_default: false },
  ],
  'admin@nself.org': [
    { title: 'My Tasks', description: 'Daily tasks and reminders', color: '#ec4899', is_default: true },
    { title: 'Configuration', description: 'App settings and management', color: '#f97316', is_default: false },
  ],
  'user@nself.org': [
    { title: 'Personal', description: 'Personal goals and daily todos', color: '#22c55e', is_default: true },
    { title: 'Learning', description: 'Documentation and tutorials', color: '#14b8a6', is_default: false },
  ],
};

const SAMPLE_TODOS: Record<string, Record<string, { title: string; completed: boolean }[]>> = {
  'owner@nself.org': {
    'Getting Started': [
      { title: 'Welcome to ɳTask - Explore the features!', completed: true },
      { title: 'Try creating a new list', completed: false },
      { title: 'Test real-time collaboration', completed: false },
    ],
    'Work Tasks': [
      { title: 'Review RBAC configuration', completed: false },
      { title: 'Test real-time GraphQL subscriptions', completed: false },
    ],
  },
  'admin@nself.org': {
    'My Tasks': [
      { title: 'Explore the dashboard', completed: false },
      { title: 'Customize your profile', completed: false },
    ],
    'Configuration': [
      { title: 'Set up application settings', completed: false },
      { title: 'Configure user management', completed: false },
      { title: 'Test SSO authentication flow', completed: false },
    ],
  },
  'user@nself.org': {
    'Personal': [
      { title: 'Explore the dashboard', completed: false },
      { title: 'Customize your profile', completed: false },
      { title: 'Try the offline features', completed: false },
    ],
    'Learning': [
      { title: 'Review the documentation', completed: false },
      { title: 'Share a list with another user', completed: false },
      { title: 'Try real-time collaboration', completed: false },
    ],
  },
};

// Owner shares lists with the other seed users, exercising np_list_shares.
const SAMPLE_SHARES: {
  ownerEmail: string;
  listTitle: string;
  withEmail: string;
  permission: 'owner' | 'editor' | 'viewer';
}[] = [
  { ownerEmail: 'owner@nself.org', listTitle: 'Getting Started', withEmail: 'admin@nself.org', permission: 'editor' },
  { ownerEmail: 'owner@nself.org', listTitle: 'Getting Started', withEmail: 'user@nself.org', permission: 'viewer' },
];

// ── Hasura GraphQL (admin) helper ────────────────────────────────────────────
async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '));
  }
  return json.data as T;
}

// ── nSelf Auth (hasura-auth) helpers ─────────────────────────────────────────
/**
 * Create the user via /signup/email-password, or sign in if it already exists.
 * Returns the user's UUID, or null on failure.
 */
async function createOrGetUser(
  email: string,
  password: string,
  displayName: string
): Promise<string | null> {
  // Attempt signup first.
  const signupRes = await fetch(`${AUTH_URL}/signup/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, options: { displayName } }),
  });

  if (signupRes.ok) {
    const data = await signupRes.json().catch(() => null);
    const id = data?.session?.user?.id;
    if (id) {
      console.log(`  Created ${email}`);
      return id;
    }
    // Email verification may suppress the session — fall through to signin.
  }

  // Already exists (or no session returned) — sign in to resolve the id.
  const signinRes = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (signinRes.ok) {
    const data = await signinRes.json().catch(() => null);
    const id = data?.session?.user?.id;
    if (id) {
      console.log(`  User ${email} already exists`);
      return id;
    }
  }

  const err = await signinRes.text().catch(() => signinRes.statusText);
  console.error(`  Error resolving user ${email}: ${err}`);
  return null;
}

// ── Seeding routines ─────────────────────────────────────────────────────────
async function seedLists(userId: string, email: string): Promise<Record<string, string>> {
  const lists = SAMPLE_LISTS[email];
  if (!lists || lists.length === 0) return {};

  const listMap: Record<string, string> = {};

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i];

    const existing = await gql<{ np_lists: { id: string }[] }>(
      `query ($uid: uuid!, $title: String!) {
        np_lists(where: { user_id: { _eq: $uid }, title: { _eq: $title } }, limit: 1) { id }
      }`,
      { uid: userId, title: list.title }
    );

    if (existing.np_lists.length > 0) {
      console.log(`  List "${list.title}" already exists`);
      listMap[list.title] = existing.np_lists[0].id;
      continue;
    }

    const inserted = await gql<{ insert_np_lists_one: { id: string } }>(
      `mutation ($obj: np_lists_insert_input!) {
        insert_np_lists_one(object: $obj) { id }
      }`,
      {
        obj: {
          user_id: userId,
          title: list.title,
          description: list.description,
          color: list.color,
          is_default: list.is_default,
          position: i,
        },
      }
    );

    console.log(`  Created list: ${list.title}`);
    listMap[list.title] = inserted.insert_np_lists_one.id;
  }

  return listMap;
}

async function seedTodos(userId: string, email: string, listMap: Record<string, string>) {
  const todosByList = SAMPLE_TODOS[email];
  if (!todosByList) return;

  let totalTodos = 0;

  for (const [listTitle, todos] of Object.entries(todosByList)) {
    const listId = listMap[listTitle];
    if (!listId) {
      console.log(`  Skipping todos for "${listTitle}" - list not found`);
      continue;
    }

    // Skip titles that already exist in this list (idempotent re-run).
    const existing = await gql<{ np_todos: { title: string }[] }>(
      `query ($listId: uuid!) {
        np_todos(where: { list_id: { _eq: $listId } }) { title }
      }`,
      { listId }
    );
    const existingTitles = new Set(existing.np_todos.map((t) => t.title));

    const objects = todos
      .filter((t) => !existingTitles.has(t.title))
      .map((t, i) => ({
        user_id: userId,
        list_id: listId,
        title: t.title,
        completed: t.completed,
        position: i,
      }));

    if (objects.length === 0) {
      console.log(`  Todos already exist in "${listTitle}"`);
      continue;
    }

    const inserted = await gql<{ insert_np_todos: { affected_rows: number } }>(
      `mutation ($objs: [np_todos_insert_input!]!) {
        insert_np_todos(objects: $objs) { affected_rows }
      }`,
      { objs: objects }
    );

    const n = inserted.insert_np_todos.affected_rows;
    console.log(`  Seeded ${n} todos in "${listTitle}"`);
    totalTodos += n;
  }

  if (totalTodos > 0) {
    console.log(`  Total todos seeded: ${totalTodos}`);
  }
}

async function seedShares(
  userIds: Record<string, string>,
  listMaps: Record<string, Record<string, string>>
) {
  for (const share of SAMPLE_SHARES) {
    const invitedBy = userIds[share.ownerEmail];
    const targetUserId = userIds[share.withEmail];
    const listId = listMaps[share.ownerEmail]?.[share.listTitle];

    if (!invitedBy || !targetUserId || !listId) {
      console.log(
        `  Skipping share of "${share.listTitle}" → ${share.withEmail} (missing user or list)`
      );
      continue;
    }

    // UNIQUE(list_id, shared_with_email) — check before inserting.
    const existing = await gql<{ np_list_shares: { id: string }[] }>(
      `query ($listId: uuid!, $email: String!) {
        np_list_shares(
          where: { list_id: { _eq: $listId }, shared_with_email: { _eq: $email } }
          limit: 1
        ) { id }
      }`,
      { listId, email: share.withEmail }
    );

    if (existing.np_list_shares.length > 0) {
      console.log(`  Share "${share.listTitle}" → ${share.withEmail} already exists`);
      continue;
    }

    await gql(
      `mutation ($obj: np_list_shares_insert_input!) {
        insert_np_list_shares_one(object: $obj) { id }
      }`,
      {
        obj: {
          list_id: listId,
          shared_with_user_id: targetUserId,
          shared_with_email: share.withEmail,
          permission: share.permission,
          invited_by: invitedBy,
          accepted_at: new Date().toISOString(),
        },
      }
    );

    console.log(`  Shared "${share.listTitle}" → ${share.withEmail} (${share.permission})`);
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────
async function seedDatabase() {
  console.log('\nSeeding ɳTask backend (Hasura + nSelf Auth)...');
  console.log(`  Hasura: ${HASURA_URL}`);
  console.log(`  Auth:   ${AUTH_URL}\n`);

  const userIds: Record<string, string> = {};

  console.log('Creating users...');
  for (const user of SEED_USERS) {
    const id = await createOrGetUser(user.email, user.password, user.displayName);
    if (id) userIds[user.email] = id;
  }

  console.log('\nSeeding lists...');
  const listMaps: Record<string, Record<string, string>> = {};
  for (const user of SEED_USERS) {
    const userId = userIds[user.email];
    if (!userId) continue;
    console.log(`  ${user.email}:`);
    listMaps[user.email] = await seedLists(userId, user.email);
  }

  console.log('\nSeeding todos...');
  for (const user of SEED_USERS) {
    const userId = userIds[user.email];
    if (!userId) continue;
    console.log(`  ${user.email}:`);
    await seedTodos(userId, user.email, listMaps[user.email] || {});
  }

  console.log('\nSeeding shares...');
  await seedShares(userIds, listMaps);

  console.log('\n--- Seed Complete ---\n');
  console.log('Default credentials:');
  for (const user of SEED_USERS) {
    console.log(`  ${user.email.padEnd(24)} ${user.password.padEnd(14)} (${user.role})`);
  }
  console.log('');
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
