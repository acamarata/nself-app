# Changelog

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
