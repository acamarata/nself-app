# Features

**Status:** Active. This is the canonical inventory of what ɳTasks does today, checked against the actual mobile, web, and backend code. Every entry is either shipped and working (Active), working but not fully rolled out everywhere (Beta), on the roadmap (Planned), or explicitly noted as backend-only or partial.

## Requirements

| Item | Required | Notes |
|---|---|---|
| pnpm 10+ and Node 20+ | Required | Per `apps/mobile/package.json` |
| Expo CLI | Required (mobile/TV) | `npm install -g expo-cli` |
| Backend stack | Required for self-host | `cd backend && make up`, or use the hosted [task.nself.org](https://task.nself.org) |
| Tier | Free | ɳTasks is free-plugins-only by design, no paid bundles |

## Lists

| Feature | Status | Description |
|---|---|---|
| Multiple lists | Active | Create any number of lists with custom colors, icons, and descriptions |
| Drag-and-drop reordering | Active | Manual list ordering, plus a default-list setting |
| List templates | Active | Shopping list, work tasks, travel checklist, and more |
| Location-based lists | Active | Attach geo-coordinates to a list |
| Arrival reminders | Active | Notify when entering a list's location radius (100m default) |

## Tasks

| Feature | Status | Description |
|---|---|---|
| Due dates | Active | Natural-language input ("tomorrow", "next monday", "in 3 days") |
| Priority levels | Active | None, Low, Medium, High, color-coded |
| Tags | Active | Autocomplete, multi-select, filter by tag |
| Notes | Active | Long-form notes on each task |
| Subtasks | Active | Tasks can have child subtasks |
| Comments | Active | Discussion thread on a task, used for collaboration |
| Attachments | Active | Multiple files per task (images, PDFs, etc.), via `np_attachments` |
| Assignees | Active | Assign a task to a collaborator on a shared list |
| Recurring tasks | Active | Daily, weekly, monthly patterns, auto-reset at 3:00 AM daily |
| Snooze / reminders | Active | Configurable due-date reminders (60 / 30 / 15 minutes before) |
| Geolocation | Active | Per-task coordinates with proximity-based reminders |
| Evening digest | Active | Daily 8:00 PM summary of tomorrow's tasks |
| Overdue highlighting | Active | Color-coded urgency for past-due tasks |

## Collaboration

| Feature | Status | Description |
|---|---|---|
| List sharing | Active | Share a list with another account; permission levels are Owner / Editor / Viewer |
| Invites | Active | Email-based invites with pending and accepted states |
| Public share links | Active | Generate a read-only shareable link; the backend auto-generates the link token (`np_list_shares.token`) on creation |
| Presence | Active | See who's viewing or editing a list in real time, avatar stack (max 5 visible, "+N" overflow), editing indicators |
| Live sync | Active | Changes propagate to collaborators via GraphQL subscriptions |
| Conflict resolution | Active | Last-write-wins with optimistic updates |
| Shared-with-me view | Active | Dedicated view for lists other people have shared with you |

## Smart views

| Feature | Status | Description |
|---|---|---|
| Today | Active | Tasks due today, grouped by list |
| Overdue | Active | Past-due incomplete tasks, sorted by due date |
| Upcoming | Active | Tasks due soon |
| Calendar | Active | Week-at-a-glance, color-coded by list |

## Search, filtering, and sorting

| Feature | Status | Description |
|---|---|---|
| Real-time search | Active | Search across task titles, notes, and tags as you type |
| Filter by status/priority/tags/due date | Active | Multi-select filters with active-filter badges and quick-remove |
| Filter persistence | Active | Filters stay applied while navigating |
| Sort by created date, due date, priority, or title | Active | Persistent per-session sort preference |
| Manual drag-and-drop order | Active | Custom ordering within a list |

## Bulk operations

| Feature | Status | Description |
|---|---|---|
| Multi-select mode | Active | Toggle selection with a single tap |
| Bulk complete / uncomplete / delete | Active | Act on multiple tasks at once, with confirmation on delete |
| Move between lists | Planned | Not yet built |

## Offline support

| Feature | Status | Description |
|---|---|---|
| Offline mutation queue (mobile) | Active | Task and list mutations made while offline (create, update, toggle, delete, subtasks) are queued locally with `@nself/offline-queue` on an MMKV-backed store and replayed when connectivity returns |
| Offline banner | Active | Mobile shows a persistent banner when the device is offline |
| Desktop offline fallback | Active | Desktop app shows a fallback screen when it can't reach the backend, instead of a blank window |

## Push notifications

| Feature | Status | Description |
|---|---|---|
| Mobile push (iOS/Android) | Active | Real Expo push token registration against `np_device_tokens`, tap-to-navigate from a notification into the relevant task |
| Notification types | Active | Task assigned, due-date reminder, list shared, evening digest, list updated by a collaborator |
| Multi-channel delivery | Active | Push, email, and in-app |
| Notification center | Active | Bell icon with unread badge |
| Smart batching | Active | Groups notifications to avoid spam |
| Web push | Planned | Not yet implemented; web currently relies on in-app and email notifications |

## Account security

| Feature | Status | Description |
|---|---|---|
| Email + password auth | Active | Hasura Auth, JWT-based |
| MFA | Active | Both backend and frontend UI are real: the backend tracks state in `task_users.mfa_enabled` (server source of truth, read-only to the app), and there's a dedicated setup screen on mobile (`MfaSetupScreen`) and a Security tab on web (`SecurityTab`) that reads and reflects that server state |
| Account lifecycle | Active | Change email, change password, delete account, export data, exposed as backend API routes on web |
| Server-URL switching (mobile) | Active | Point the mobile app at a different backend (self-hosted or hosted) without reinstalling |

## Internationalization

| Feature | Status | Description |
|---|---|---|
| Supported locales | Active | English, Spanish, French, Arabic (`en`, `es`, `fr`, `ar`) on mobile, web, and TV |
| RTL support | Active | Arabic locale includes right-to-left layout handling |
| Locale completeness checks | Active | `scripts/check-i18n-completeness.ts` verifies no missing keys across locales in CI |

## Attachments

| Feature | Status | Description |
|---|---|---|
| Drag-and-drop upload | Active | Drop files directly onto a task (web) |
| File preview | Active | Type-aware icons for images, documents, etc. |
| Download and delete | Active | Full file lifecycle |
| Per-attachment size limit | Active | 10MB default, configurable server-side |

## User preferences

| Feature | Status | Description |
|---|---|---|
| Theme | Active | Light, Dark, System |
| Time format | Active | 12-hour or 24-hour |
| Default list | Active | Choose which list opens first |
| Notification settings | Active | Per-channel, per-type controls |
| Auto-hide completed tasks | Active | Toggle visibility |

## Cross-platform targets

See [[Apps]] for a full breakdown of what's shipped, in progress, or blocked on credentials for each surface.

| Target | Status |
|---|---|
| Web (task.nself.org) | Active |
| Desktop (macOS/Windows/Linux) | Shipped, unsigned builds; signed/notarized builds pending Apple and Windows certs |
| Mobile (Android) | Active, APK available |
| Mobile (iOS) | Blocked on Apple Developer signing and a dependency fix, see [[Apps]] |
| TV (Apple TV / Android TV) | Early preview, builds locally, no store release yet |

## Limitations

- Move-between-lists in bulk operations is Planned, not built.
- Web push notifications are not implemented; web relies on in-app and email.
- TV is an early preview, not a finished app.
- iOS builds are currently blocked, see [[Apps]] for the specifics.
- Free plugins only. Paid bundles and pro plugins are out of scope for this repo by design.

## Troubleshooting

### Backend services don't start

**Symptom:** `make up` fails or services exit immediately.
**Fix:** confirm `.env.dev` exists (`cp backend/.env.example backend/.env.dev`), free any conflicting ports (`lsof -i :8080,4000,5432,9000`), then `make up` again.

### App can't reach the backend

**Symptom:** GraphQL calls fail with network errors.
**Fix:** run `cd backend && make health`. If it's healthy, check the app's `.env.local` points at the right endpoint. Mobile simulators sometimes need your host machine's LAN IP instead of `localhost`.

### Migrations out of date

**Symptom:** tables missing or schema doesn't match what's expected.
**Fix:** `cd backend && make migrate`, then confirm with `make migrate-status`.

## Related

- [[Self-Hosting]]: running your own backend
- [[Apps]]: per-surface status
- [[Backend-Architecture]]: services, ports, and data flow
- [[Database-Schema]]: table reference
- [[Home]]: wiki home
