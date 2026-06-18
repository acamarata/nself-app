# UI States — ɳTask Mobile (7-State Pattern)

Every data-driven screen in ɳTask implements a 7-state pattern. This document describes each state and which screens implement it.

## The 7 States

| State | When | Component |
|---|---|---|
| `loading` | First fetch in progress, no cached data | `SkeletonList` — 10 animated placeholder rows |
| `empty` | Fetch complete; zero items returned | `EmptyState` — icon + message + optional CTA |
| `error` | Server/network error; no cached data | `ErrorCard` — message + retry button |
| `populated` | Items available (online or cached) | `FlashList` / `FlatList` with `RefreshControl` |
| `offline` | `isConnected === false` | `OfflineBanner` at top; cached data still shown |
| `permission-denied` | Auth error (401/403/jwt) | `PermissionDenied` — reconnect to nSelf server |
| `rate-limited` | GraphQL rate limit (429) | `RateLimitedCard` — live countdown timer |

## Screens

### HomeScreen (`src/app/HomeScreen.tsx`)

Shows task lists (projects). Implements all 7 states.

- Loading: `SkeletonList` (6 rows, rowHeight=72)
- Empty: "No lists yet — Tap + to create your first list"
- Error: `ErrorCard` with retry
- Populated: `FlatList` with list cards + `RefreshControl`
- Offline: `OfflineBanner` at top; lists still visible from urql cache
- Permission-denied: `PermissionDenied`
- Rate-limited: `RateLimitedCard`

### ListScreen (`src/app/ListScreen.tsx`)

Shows tasks within a list. Implements all 7 states. Uses `FlashList` for virtualization.

- Loading: `SkeletonList` (10 rows, rowHeight=60)
- Empty: "No tasks yet — tap + to create your first task"
- Error: `ErrorCard` with retry
- Populated: `FlashList` (estimatedItemSize=60) with `TaskCard` rows
- Offline: `OfflineBanner` + locally cached tasks; new tasks show as pending
- Permission-denied: `PermissionDenied`
- Rate-limited: `RateLimitedCard`

## Optimistic Mutations

When creating a task online:
1. Task appended immediately to list with `pending: true`.
2. `TaskCard` renders with 55% opacity, spinner, and "Saving…" label.
3. On server success: pending task removed; real task appears via `refetch()`.
4. On server error: pending task removed; Alert shown with "Task not saved — Retry" option.

When creating a task offline:
1. Task appended with `pending: true` (same UI).
2. Mutation enqueued in MMKV offline queue.
3. On reconnect: queue flushed; task confirmed or retry logic applied.

## Components (`src/components/seven-states/`)

| File | State |
|---|---|
| `OfflineBanner.tsx` | Offline — animated fade, shows queue count |
| `SkeletonList.tsx` | Loading — pulsing placeholder rows |
| `EmptyState.tsx` | Empty — icon + title + optional CTA button |
| `ErrorCard.tsx` | Error — message + retry |
| `RateLimitedCard.tsx` | Rate-limited — live countdown |
| `PermissionDenied.tsx` | Permission-denied — reconnect prompt |

All components are accessible (`accessibilityRole`, `accessibilityState`, `accessibilityLiveRegion`).
