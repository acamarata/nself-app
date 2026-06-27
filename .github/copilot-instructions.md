# GitHub Copilot Instructions for ɳTasks

ɳTasks is a multi-surface task management app: React Native + Expo (mobile), React 19 + Vite SPA (web), Tauri 2 (desktop, planned), react-native-tvos (TV, planned). Backend is Hasura GraphQL + nSelf Auth over `np_*` PostgreSQL tables.

## Core Rules

1. **Schema prefix is `np_*`** — all tables are `np_lists`, `np_todos`, `np_shares`, `np_attachments`, `np_comments`, `np_subtasks`, `np_presence`.
2. **GraphQL only** — never import pg/prisma/drizzle directly in app code. Go through Hasura.
3. **Auth via nSelf Auth** — use `EXPO_PUBLIC_AUTH_URL` (mobile) or `VITE_AUTH_URL` (web). Never raw `Authorization` headers — use the shared `@nself/auth-core` hook.
4. **pnpm only** — never npm/yarn/bun.
5. **TypeScript strict** — no `any`, no `// @ts-ignore` without linked issue.
6. **No `'use client'`** — this is not Next.js. Mobile = React Native, web = Vite SPA (no SSR).
7. **Free plugins only** — `ntask/` consumes only free plugins (`plugins/`). Never reference pro plugins.

## Surface-Specific Patterns

### Mobile (`apps/mobile/`)

- Framework: React Native 0.79.7 + Expo SDK 53
- Routing: Expo Router (file-based, `app/` dir inside `apps/mobile/`)
- State: React Query + Apollo Client for GraphQL
- Env prefix: `EXPO_PUBLIC_*`
- Test: jest-expo

```typescript
// Correct mobile import pattern
import { useAuth } from '@nself/auth-core';
import { useTasks } from '@/hooks/use-tasks';
import { np_todos } from '@/lib/graphql/operations';
```

### Web SaaS (`apps/web/`)

- Framework: React 19 + Vite 6 (SPA — no SSR, no Next.js)
- Routing: React Router v7
- State: React Query + Apollo Client for GraphQL
- Env prefix: `VITE_*`
- Test: Vitest

```typescript
// Correct web import pattern
import { useAuth } from '@nself/auth-core';
import { useTasks } from '@/hooks/use-tasks';
```

## File Organization

### Mobile (`apps/mobile/src/`)
- Screens: `app/(tabs)/[screen].tsx` (Expo Router tabs)
- Components: `components/[feature]/[Name].tsx`
- Hooks: `hooks/use-[name].ts`
- GraphQL: `lib/graphql/operations.ts` (codegen output — do not hand-edit)
- Types: `lib/types/[name].ts`

### Web (`apps/web/src/`)
- Pages: `pages/[Route].tsx` (React Router)
- Components: `components/[feature]/[Name].tsx`
- Hooks: `hooks/use-[name].ts`
- GraphQL: `lib/graphql/operations.ts` (codegen output — do not hand-edit)
- Types: `lib/types/[name].ts`

## Reference Files

- `backend/hasura/metadata/` — Hasura table definitions, permissions, relationships
- `backend/postgres/migrations/` — SQL migrations (`np_*` schema)
- `apps/mobile/src/lib/graphql/` — current mobile operation definitions
- `apps/web/src/lib/graphql/` — current web operation definitions
- `.claude/docs/ARCHITECTURE.md` — full system architecture
- `.claude/docs/FEATURES.md` — feature inventory
