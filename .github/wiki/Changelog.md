# Changelog

## v1.3.1 — 2026-08-18

Patch release. Security hardening, a working account-recovery path, and the
removal of a large amount of scaffolding that looked like coverage but ran
nothing.

### Fixed

- **Password reset worked end to end for the first time.** Three independent
  defects, each fatal on its own: nothing routed the emailed link (hasura-auth
  always redirects to the bare origin and only honours a `redirectTo` that is
  allowlisted, and the allowlist was empty); the confirm page read `?ticket=`,
  which hasura-auth consumes before redirecting; and the API route posted to
  `/user/password/reset/confirm`, which does not exist in hasura-auth 0.36 and
  answers 404. Fixed in the web surface (`nself-org/web#108`).
- **Hasura permission holes on the `user` role**, and owner/`app_admin` roles
  that could not insert at all — 34 missing column presets across 17 tables.
- **Collaborator profiles restored** without exposing email addresses, closing
  a live account-enumeration hole.
- **Action handlers**: corrected dead auth routes, secured the functions
  webhook, unified the auth port.
- **43 of 45 OSV dependency vulnerabilities** cleared; the remaining two are
  build-time only, unreachable at runtime, and have no upstream fix.
- Mobile: release-blocking defects, and `@xmldom/xmldom` pinned so
  `expo prebuild -p ios` succeeds.
- Desktop: macOS-only `RunEvent::Reopen` gated so Linux and Windows compile;
  updater signing key rotated to a usable passphrase-free minisign key.
- TV and desktop: bucket nav filtering, Android TV focus, filesystem
  permissions.
- Email: removed Nhost branding from hasura-auth templates, made transactional
  mail concise, and corrected the brand glyph — bodies rendered U+019E (`ƞ`)
  while the subject used U+0273 (`ɳ`).

### Changed

- All five app surfaces now live under `apps/` (`cli` and `mcp` moved in), so
  the tree answers "what surfaces exist" on its own.
- Documented Postmark as the transactional provider. Elastic Email appends a
  compliance footer and unsubscribe link controlled by the billing account,
  which cannot be overridden per sub-account and lands on password-reset mail.

### Removed

- `integration_test/` — Flutter's directory convention, left behind when
  Flutter was eliminated, holding one file referenced by nothing.
- Deep-link association files that were never deployed and had drifted to an
  unsubstituted `APPLE_TEAM_ID` placeholder with `/shared/*` missing. The live
  files are served from the web repo.
- A duplicate security workflow: gitleaks ran twice, and two workflows shared
  the display name "Security Scan", making them indistinguishable in the
  Actions UI and unusable as distinct required checks.
- The old e2e suite, which had never executed once — no workflow invoked it,
  `pnpm test:e2e` was undefined, `@playwright/test` was not a declared
  dependency, and `testDir` resolved to a path that matched nothing. Its
  assertions (`<body>` is visible; status under 500) would have stayed green
  through the password-reset outage. Replaced with read-only contract tests
  that run against the deployed surface on push, PR, and a daily schedule.

## v1.3.0 — 2026-07-06

Feature-complete apps milestone.

### Added

- **Mobile**: working push notifications with real `np_device_tokens`
  registration and tap-to-navigate, a functional server-URL switch, an offline
  queue for task-detail mutations, and Today/Overdue/Upcoming smart views.
- **Desktop**: opens on a chrome-free Welcome screen in app mode, brand icons,
  keychain integration, offline fallback, and autostart wiring.
- **Backend**: RBAC, share tokens, and MFA support — `np_list_shares.token`
  auto-generation and `task_users.mfa_enabled`.
- A real updater signing key, replacing one CI could not use.

### Fixed

- Desktop updater manifest mismatch.
- Mobile: pnpm-compatible entry point, `react-native-screens` 4.11.1 for
  RN 0.79, and Metro workspace/ESM/node-stub resolvers with a hoisted linker,
  enabling local and EAS Android builds.
- CI: sibling `@nself/*` packages are cloned in every pnpm workflow, from the
  repo root rather than the job's working directory, with their own
  dependencies installed and bash forced on Windows runners.
- Backend: `Makefile` routed through the nself CLI, `POSTGRES_DB` default
  corrected to `ntask`.

### Changed

- Documentation aligned with runtime reality: env-var surface, `nself.yaml`
  plugin manifest, and the Backend-Setup guide.

## v1.2.1 — 2026-07-03

Patch release. CI stabilization, RBAC/identity, CLI+MCP, and prod deploy fixes on top of v1.2.0.

### Added

- **CLI + MCP server** (`cli/`, `mcp/`) — manage tasks/lists from the terminal or expose them as MCP tools for AI agents (Claude, Cursor, etc.).
- **Identity + dynamic RBAC** — elevated-role Hasura permissions, `auth.uid()` RLS helper.
- Mobile prod remote-URL default: preview/production EAS builds now bake in `https://api.task.nself.org` so store builds work out of the box; self-host users can still override at first login.
- Desktop (Tauri) prod remote-URL default + CSP endpoint config; fixed plugin null-config panics.
- Mobile release runbook (`apps/mobile/RELEASING.md`).

### Fixed

- Backend: Hasura metadata (sources/actions), seed data, nginx config, pg_cron-free migrations, hardcoded `\c nself` in postgres init scripts.
- CI: desktop build workflows (dist placeholder path, pnpm workspace symlinks, Windows runner, Dependabot secret access), removed dead workflows.
- Restored main content lost in a prior squash-merge (#75).
- Dependabot: unblocked PRs by skipping private-token jobs on dependabot-triggered runs; bumped `actions/cache`, `actions/setup-node`, `actions/download-artifact`, `pnpm/action-setup`, `expo/expo-github-action` to current majors.

### Changed

- `apps/tv/SPIKE.md` status corrected — the TypeScript/React layer (6 screens, D-pad focus navigation, GraphQL client, 77 passing tests) is implemented and tested, not just a scaffold; only on-device EAS build/provisioning remains.

---

## v1.2.0 — 2026-06-28

ɳTask's biggest release: a complete, multi-surface task manager — free, self-hostable, and FOSS.

### New surfaces
- **Desktop** (Tauri 2) — Windows/macOS/Linux, wraps the web app, native menu/tray/auto-updater/deep-links.
- **TV** (react-native-tvos) — Apple TV / Android TV / Fire TV read-focused dashboard with D-pad focus navigation.

### Features (all surfaces)
- Subtasks, comments, tags, attachments, reminders, recurring tasks, full-text search, filters, sort, saved views.
- **Collaboration** — list sharing, email invites, roles, share-links, real-time presence, transfer ownership.
- **Account & privacy** — in-app account deletion, GDPR data export, MFA, session management, change email/password.
- Dark mode (app-wide), i18n (en/ar/fr/es) + RTL, offline-first with sync, command palette, keyboard shortcuts, PWA.

### Backend / self-host
- Canonical `np_*` schema with RLS + multi-app isolation; Hasura allow-list, rate limiting, SSRF guard, cron triggers, backup/DR.
- One-command self-host (`make bootstrap`); free plugins only (auth/storage/cron/notify); `nself.yaml` bundle manifest.

### Quality
- Mobile 73% / web 60%+ test coverage; cross-surface a11y (WCAG AA) + i18n CI gates; all surfaces build/test green.



All notable changes to ɳTasks will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- P5 multi-surface architecture: React Native mobile, Vite web SaaS, Tauri desktop (planned), rn-tvos TV (planned)
- Epic I docs/SPORT hygiene: all Flutter/Next.js refs purged from wiki, .claude/docs, and SPORT registries
- SPORT registry entries for task.nself.org and apps/mobile surfaces

---

## [1.1.4] — 2026-05-21

Patch release. App version bumped to 1.1.4+1.

### Fixed

- ci: doc-sync version-file matrix now recognizes `.github/wiki/Changelog.md` as a valid version-doc surface for Type C app repos.

---

## [1.1.0] — 2026-05-15

Minor release. nSelf-First migration complete. task.nself.org hosted demo updated.

### Added

- **task.nself.org hosted demo**: web/ntask SaaS version updated to v1.1.0 backend stack.
- **nSelf-First backend**: `make up` now delegates to `nself start` (P98 02.T14 migration finalized). `nself build` generates `docker-compose.yml` from CLI templates.

### Changed

- Minimum nSelf CLI version: v1.1.0.
- `make up` / `make down` confirmed as thin aliases for `nself start` / `nself stop` (D6 exception fully superseded).
- Backend stack: PostgreSQL + Hasura + Auth + Storage aligned with CLI v1.1.0 service contracts.

---

## How to Update This Changelog

When making changes:

1. Add entries under the `[Unreleased]` section
2. Use categories: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**
3. When releasing: move `[Unreleased]` entries to a new versioned section, update `apps/mobile/package.json` `version:` field and SPORT F01.

**Note:** This changelog is maintained manually. Update it as part of every PR.
