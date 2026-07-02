# Features

**Status:** Active

## Overview

ɳTasks is a self-hosted, collaborative task management app. Built on a React Native/Vite/Tauri multi-surface client and a Postgres + Hasura + Auth backend, it ships a deep feature set across list management, advanced todos, real-time collaboration, sharing, search/filtering, smart views, attachments, notifications, and user preferences.

This page is the canonical inventory of every shipped capability. Each feature has a status, a one-line description, and (where relevant) configuration and usage notes. Status uses the master-list scheme: Active, Beta, Planned, Deprecated.

## Requirements

| Item | Required | Notes |
|---|---|---|
| pnpm 10+ + Node 20+ | Required | Per `apps/mobile/package.json` |
| Expo CLI | Required (mobile) | `npm install -g expo-cli` |
| Backend stack | Required | `cd backend && make up` (Postgres + Hasura + Auth + Storage + MinIO + Mailpit) |
| Tier | Free | `ntask` is free-plugins-only by design (per F03, F12) |
| Bundle | None | No paid bundle required |

## Configuration

Most feature configuration is in per-surface app settings (per-user preferences) and in `backend/.env.dev` (server-side defaults). The full env reference lives in [Backend Setup](Backend-Setup) and [Environment Variables](Environment-Variables).

| Env Var | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `nself` | Postgres database name |
| `HASURA_GRAPHQL_ADMIN_SECRET` | (set in `.env.dev`) | Required to access the Hasura console |
| `AUTH_JWT_CUSTOM_CLAIMS` | (set in `.env.dev`) | Custom JWT claims for app permissions |

## Feature Inventory

### List Management

| Feature | Status | Description |
|---|---|---|
| Multiple lists | Active | Create unlimited lists with custom colors, icons, and descriptions |
| Smart organization | Active | Drag-and-drop reordering, default list support |
| List templates | Active | Shopping list, work tasks, travel checklist, and more |
| Location-based lists | Active | Attach geo-coordinates to lists (e.g., "Grocery, Whole Foods") |
| Arrival reminders | Active | Notify when entering a list's location radius (100m default) |

### Advanced Todo Features

| Feature | Status | Description |
|---|---|---|
| Due dates | Active | Natural-language input ("tomorrow", "next monday", "in 3 days") |
| Priority levels | Active | None, Low, Medium, High (color-coded) |
| Tags | Active | Autocomplete, multi-select, filter by tags |
| Notes | Active | Long-form notes attached to each todo |
| Attachments | Active | Multiple files per todo (images, PDFs, etc.) |
| Geolocation | Active | Per-todo coordinates with radius-based reminders |
| Recurring tasks | Active | Daily, weekly, monthly patterns |
| Recurring auto-reset | Active | Resets at 3:00 AM daily |
| Due reminders | Active | Customizable timing (60 / 30 / 15 minutes before) |
| Evening digest | Active | 8:00 PM daily digest of tomorrow's tasks |
| Location reminders | Active | Haversine distance-based proximity alerts |
| Overdue highlighting | Active | Color-coded urgency for past-due todos |

### Real-Time Collaboration

| Feature | Status | Description |
|---|---|---|
| Live presence | Active | See who is viewing or editing each list in real time |
| User avatars | Active | Overlapping avatar stack (max 5 visible, "+N" overflow) |
| Editing indicators | Active | Visual cues when someone is editing a specific todo |
| Instant sync | Active | Changes propagate to collaborators within 500ms |
| Conflict resolution | Active | Last-write-wins with optimistic updates |

### Sharing

| Feature | Status | Description |
|---|---|---|
| Granular permissions | Active | Owner / Editor / Viewer roles per list |
| Invite system | Active | Email-based invites with pending and accepted states |
| Public links | Active | Generate shareable links for read-only views |
| Permission management | Active | Change permissions or revoke access at any time |
| Shared-with-me dashboard | Active | Dedicated view for lists shared with you |

### Search and Filtering

| Feature | Status | Description |
|---|---|---|
| Real-time search | Active | Search across todos, notes, and tags as you type |
| Filter by status | Active | Active vs Completed |
| Filter by priority | Active | High / Medium / Low |
| Filter by tags | Active | Multi-select |
| Filter by due date range | Active | Date picker range |
| Active filter badges | Active | Visible chips with quick-remove |
| Filter persistence | Active | Filters stay active while navigating |

### Sorting

| Feature | Status | Description |
|---|---|---|
| Manual order | Active | Drag-and-drop position |
| Sort by created date | Active | Newest first / Oldest first |
| Sort by due date | Active | Soonest first / Latest first |
| Sort by priority | Active | High to Low |
| Sort by title | Active | A-Z |
| Persistent sort | Active | Sort preference remembered across sessions |
| Visual sort indicator | Active | Current sort order shown in the list header |

### Bulk Operations

| Feature | Status | Description |
|---|---|---|
| Multi-select mode | Active | Toggle selection mode with one tap |
| Floating action toolbar | Active | Appears when items are selected |
| Bulk complete | Active | Complete multiple todos at once |
| Bulk uncomplete | Active | Uncomplete multiple todos |
| Bulk delete | Active | Delete multiple todos with confirmation |
| Move between lists | Planned | Relocate selected todos to another list |
| Selection count badge | Active | Shows the number of selected items |

### Smart Views

| Feature | Status | Description |
|---|---|---|
| Today view | Active | All todos due today across lists, grouped by list |
| Overdue view | Active | All past-due incomplete todos, sorted by due date |
| Calendar view | Active | Week-at-a-glance, color-coded by list, today highlighted |

### Attachments

| Feature | Status | Description |
|---|---|---|
| Drag-and-drop upload | Active | Drop files directly onto todos |
| File preview | Active | Type-aware icons (images, documents, etc.) |
| Download and delete | Active | Full file lifecycle |
| File metadata | Active | Size, upload date, mime type |
| Upload progress | Active | Visual indicator during uploads |
| Per-attachment size limit | Active | 10MB default, configurable |

### Notifications

| Feature | Status | Description |
|---|---|---|
| New-todo-assigned | Active | When someone assigns you a todo |
| Due-date reminder | Active | Configurable timing |
| List-shared notification | Active | When a list is shared with you |
| Evening reminder | Active | Daily digest |
| Location reminder | Active | Triggered by entering a list's geo radius |
| List-updated by collaborator | Active | When a shared list changes |
| Multi-channel delivery | Active | Push, email, in-app |
| Notification center | Active | Bell icon with unread badge |
| Smart batching | Active | Prevents notification spam |

### User Preferences

| Feature | Status | Description |
|---|---|---|
| Time format | Active | 12-hour vs 24-hour |
| Auto-hide completed | Active | Toggle visibility of completed tasks |
| Theme | Active | Light, Dark, System |
| Default list | Active | Choose which list opens first |
| Notification settings | Active | Per-channel, per-type controls |
| Evening reminder time | Active | Customize the daily digest hour |
| Due reminder timing | Active | 15 / 30 / 60 minutes before |

### Cross-Platform Targets

| Target | Status | Notes |
|---|---|---|
| Mobile (iOS + Android) | Building | React Native + Expo; EAS Build profiles configured |
| Web SaaS | Building | React + Vite SPA; hosted at `task.nself.org`, built in the separate `web/ntask` repo |
| Desktop (macOS/Windows/Linux) | Shipped | Tauri 2 shell wrapping `web/ntask`, in `apps/desktop/` |
| TV (Apple TV + Android TV) | Scaffolded | react-native-tvos in `apps/tv/`; package isolation solved, EAS build pending |

## Limitations

- TV surface is Scaffolded, not fully built out — EAS release build not yet triggered.
- iOS and Android store submissions are in progress. EAS Build configured but not yet submitted to App Store / Play Console.
- Move-between-lists in bulk operations is Planned, not Active.
- Free plugins only. The pro plugin set (ai, claw, mux, livekit, etc.) is intentionally out of scope per F03 and F12.

## Known Issues

None currently tracked. Report issues at [github.com/nself-org/ntask/issues](https://github.com/nself-org/ntask/issues).

## Troubleshooting

### Backend services don't start

**Symptom:** `make up` fails or services exit immediately.
**Cause:** `.env.dev` not created from `.env.example`, or required ports already in use.
**Fix:** `cd backend && cp .env.example .env.dev`, then `lsof -i :8080,4000,8484,5432,9000` to free conflicting ports, then `make up` again.

### App can't reach Hasura

**Symptom:** GraphQL calls fail with network errors.
**Cause:** Backend not running, or app pointing at the wrong endpoint.
**Fix:** `cd backend && make health`. If healthy, verify the client app's GraphQL endpoint matches the platform target (`apps/mobile/` in this repo, or `web/ntask/` in the separate `web` repo). Mobile simulators may need the host machine IP instead of `localhost`.

### Hasura migrations not applied

**Symptom:** Tables missing or schema out of date.
**Cause:** Initial `init.sql` ran but Hasura YAML migrations weren't applied.
**Fix:** `cd backend && make migrate`. Confirm with `make migrate-status`.

## Related

- [Backend Setup](Backend-Setup): operator-facing setup walkthrough
- [Backend Architecture](Backend-Architecture): operator-facing architecture
- [Database Schema](Database-Schema): schema reference
- [Deployment](Deployment): staging and production deploy
- [Home](Home): wiki home

## Bottom nav

[Home](Home) | [Backend Setup](Backend-Setup) | [Backend Architecture](Backend-Architecture)
