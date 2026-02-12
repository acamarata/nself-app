import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_USERS = [
  { email: 'owner@nself.org', password: 'password', displayName: 'System Owner', role: 'owner' },
  { email: 'admin@nself.org', password: 'password', displayName: 'Administrator', role: 'admin' },
  { email: 'user@nself.org', password: 'password', displayName: 'Demo User', role: 'user' },
];

const SAMPLE_LISTS: Record<string, { title: string; description: string; color: string; is_default: boolean }[]> = {
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
      { title: 'Welcome to ɳDemo - Explore the demo features!', completed: true },
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

async function createOrGetUser(email: string, password: string, displayName: string): Promise<string | null> {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    console.log(`  User ${email} already exists`);
    return found.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    console.error(`  Error creating ${email}:`, error.message);
    return null;
  }

  console.log(`  Created ${email}`);
  return data.user.id;
}

async function assignRole(userId: string, roleName: string, assignedBy?: string) {
  const { data: role } = await supabase
    .from('app_roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle();

  if (!role) {
    console.error(`  Role '${roleName}' not found. Run RBAC migration first.`);
    return;
  }

  const { error } = await supabase
    .from('app_user_roles')
    .upsert(
      { user_id: userId, role_id: role.id, assigned_by: assignedBy || null },
      { onConflict: 'user_id,role_id' }
    );

  if (error) {
    console.error(`  Error assigning role ${roleName}:`, error.message);
  } else {
    console.log(`  Assigned role: ${roleName}`);
  }
}

async function seedLists(userId: string, email: string): Promise<Record<string, string>> {
  const lists = SAMPLE_LISTS[email];
  if (!lists || lists.length === 0) return {};

  const listMap: Record<string, string> = {};

  for (const list of lists) {
    const { data: existing } = await supabase
      .from('app_lists')
      .select('id, title')
      .eq('user_id', userId)
      .eq('title', list.title)
      .maybeSingle();

    if (existing) {
      console.log(`  List "${list.title}" already exists`);
      listMap[list.title] = existing.id;
      continue;
    }

    const { data, error } = await supabase
      .from('app_lists')
      .insert({
        user_id: userId,
        title: list.title,
        description: list.description,
        color: list.color,
        is_default: list.is_default,
        position: Date.now(),
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error creating list "${list.title}":`, error.message);
    } else {
      console.log(`  Created list: ${list.title}`);
      listMap[list.title] = data.id;
    }
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

    const todosToInsert = todos.map(t => ({
      user_id: userId,
      list_id: listId,
      title: t.title,
      completed: t.completed,
      position: Date.now(),
    }));

    const { error } = await supabase.from('app_todos').insert(todosToInsert);
    if (error) {
      if (error.message.includes('duplicate')) {
        console.log(`  Todos already exist in "${listTitle}"`);
      } else {
        console.error(`  Error seeding todos in "${listTitle}":`, error.message);
      }
    } else {
      console.log(`  Seeded ${todos.length} todos in "${listTitle}"`);
      totalTodos += todos.length;
    }
  }

  if (totalTodos > 0) {
    console.log(`  Total todos seeded: ${totalTodos}`);
  }
}

async function seedDatabase() {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'local';
  const backend = process.env.NEXT_PUBLIC_BACKEND_PROVIDER || 'bolt';

  console.log(`\nSeeding database...`);
  console.log(`  Environment: ${env}`);
  console.log(`  Backend: ${backend}\n`);

  if (backend !== 'supabase' && backend !== 'bolt') {
    console.log('Seeding is only supported for Supabase-backed environments.');
    console.log('For nSelf/Nhost, use the Hasura seed scripts in backend/.\n');
    return;
  }

  const userIds: Record<string, string> = {};

  console.log('Creating users...');
  for (const user of SEED_USERS) {
    const id = await createOrGetUser(user.email, user.password, user.displayName);
    if (id) userIds[user.email] = id;
  }

  const ownerUserId = userIds['owner@nself.org'];

  console.log('\nAssigning roles...');
  for (const user of SEED_USERS) {
    const userId = userIds[user.email];
    if (!userId) continue;
    console.log(`  ${user.email}:`);
    await assignRole(userId, user.role, user.email === 'owner@nself.org' ? undefined : ownerUserId);
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

  console.log('\n--- Seed Complete ---\n');
  console.log('Default credentials:');
  for (const user of SEED_USERS) {
    console.log(`  ${user.email.padEnd(24)} ${user.password.padEnd(14)} (${user.role})`);
  }
  console.log('');
}

seedDatabase().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
