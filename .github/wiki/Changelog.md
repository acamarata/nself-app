# Changelog

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
