# ɳTasks P5 RC Sign-Off Checklist

**Gate ticket:** N-AUX-3 (Phase-level P5 ship-gate)  
**Owner:** Final approval by user in same message turn (per PPI §Build Wave End-of-Phase Shipping)  
**Authority:** This document, once all boxes checked and user-approved, authorizes: version bump → tag → GH Release → deploy-verify  
**Source:** `p5-v1-definition-of-done.md` (master ship-gate)

---

> CRITICAL: This checklist is NOT yet complete. It maps all P5 DoD gate items to their
> current status. Items marked `[ ]` are OPEN and must be closed before N-AUX-3 runs.
> N-AUX-3 requires ALL items checked, DQA + SIEGE green, route audit clean, and explicit
> same-turn user authorization. Do not treat a partial checklist as authorization.

---

## Section A — Functional Completeness

| Gate | Ticket(s) | Status |
|---|---|---|
| Core task CRUD + lists + priority + due dates on mobile | C-series | [ ] OPEN — C epics in progress |
| Tags, subtasks, comments, recurring, reminders, attachments on mobile | C1, A-series | [ ] OPEN |
| Search, filter, sort, saved views on mobile | C1, D2 | [ ] OPEN |
| Web SaaS feature parity with mobile | D, D2 | [ ] OPEN |
| Desktop (Tauri) feature parity | E-series | [ ] OPEN |
| TV read-focused dashboard (Apple TV + Android TV + Fire TV) | F-series | [ ] OPEN |
| Collaboration (invite/roles/share-link/presence) on mobile+web+desktop | L-series | [ ] OPEN |
| TV read-awareness for collaboration | L, F | [ ] OPEN |
| 7-state UX on all 4 surfaces | C, D2, E, F | [ ] OPEN |
| Onboarding/first-run + in-app help (mobile + web) | M-series | [ ] OPEN |
| Notifications parity (mobile push, web push, desktop native, email) | C, L, K, J | [ ] OPEN |
| No feature marketed that is not implemented | D, M | [ ] OPEN |

---

## Section B — Backend & Data

| Gate | Ticket(s) | Status |
|---|---|---|
| Schema `np_*` unified, Hasura = SOT, codegen drives all clients | P0, B | [x] DONE — P0 complete (commit 6d358cd) |
| All domain tables + RLS: subtasks, comments, attachments, multi-assignee, reminders, tags, recurring, idempotency, outbox | A-series | [ ] OPEN — migrations 009–011 staged |
| No RLS data leaks; event + cron triggers firing | A | [ ] OPEN |
| Free plugins (auth/storage/cron/notify) correctly wired and seeded | A, H | [ ] OPEN |

---

## Section C — Security & Trust

| Gate | Ticket(s) | Status |
|---|---|---|
| Zero secrets in git; generated compose gitignored; all exposed secrets rotated | P0 | [x] DONE — PCI `ntask-secrets-in-history` tracked |
| Hasura allow-list + introspection off in prod; security headers; rate limiting | K | [ ] OPEN |
| Third-party pentest passed; threat model documented | K | [ ] OPEN (external gate) |
| In-app account deletion (Apple+Google mandate), GDPR export, MFA, session mgmt | J | [ ] OPEN |
| Legal pages (Privacy, ToS, Cookie/AUP, security.txt) on all surfaces | J, M | [ ] OPEN |
| Transactional email deliverable (SPF/DKIM/DMARC) | J | [ ] OPEN |

---

## Section D — Production Ops

| Gate | Ticket(s) | Status |
|---|---|---|
| Sentry + observability on all 4 surfaces + backend | K | [ ] OPEN |
| Postgres backup + verified RESTORE; DR runbook | K | [ ] OPEN |
| Performance budgets: CWV/Lighthouse, bundle size, k6 load, mobile cold-start | K, D | [ ] OPEN |
| Release safety: staged rollout, rollback runbook, post-deploy smoke | K, G | [ ] OPEN |

---

## Section E — Self-Host

| Gate | Ticket(s) | Status |
|---|---|---|
| Fresh clone → running ɳTask in N commands (`make bootstrap`) | H | [ ] OPEN |
| `nself.yaml` bundle manifest; `make upgrade`/migration runner; configurable backend URL | H | [ ] OPEN |
| Self-host smoke test green in CI; SELF-HOSTING/UPGRADE/TROUBLESHOOTING docs | H | [ ] OPEN |

---

## Section F — SaaS Deployment

| Gate | Ticket(s) | Status |
|---|---|---|
| Vercel prod + preview deploys GREEN (turbo `--filter` scoped) | D, G, K | [ ] OPEN |
| CSP served; PWA installable at task.nself.org | D, G | [ ] OPEN |
| Astro marketing site live with download links for all surfaces + SEO | M | [ ] OPEN |

---

## Section G — Distribution / Store

| Gate | Ticket(s) | Status |
|---|---|---|
| iOS App Store submitted and approved (privacy labels, account-deletion URL, screenshots) | C5, J | [ ] OPEN (external gate) |
| Google Play submitted and approved (data-safety, account-deletion URL) | C5, J | [ ] OPEN (external gate) |
| Apple TV + Android TV + Fire TV submitted | F4 | [ ] OPEN |
| Desktop signed installers (macOS notarized, Windows signed, Linux AppImage/deb) | E3 | [ ] OPEN |
| Desktop auto-update working on macOS, Windows, Linux | E3 | [ ] OPEN |

---

## Section H — Quality, A11y, I18n, Brand

| Gate | Ticket(s) | Status |
|---|---|---|
| WCAG 2.1 AA verified — web (axe zero violations + screen reader sweep) | N-S1-T1 | [~] PARTIAL — axe gate added (5 components), manual sweep pending |
| WCAG 2.1 AA verified — desktop (Playwright + axe) | N-S1-T2 | [ ] OPEN (depends on E-wave2) |
| WCAG 2.1 AA verified — mobile (C-S2-T5 + C-S7-T3) | C | [ ] OPEN — coordinate, verify |
| WCAG 2.1 AA verified — TV (F-S5-T3) | F | [ ] OPEN — coordinate, verify |
| i18n parity en/ar/fr/es on web | N-S3-T1 | [x] DONE — web has all 4 locales, all keys complete |
| i18n parity en/ar/fr/es on mobile | C-S2-T3 | [x] DONE — mobile has all 4 locales, all keys complete |
| i18n parity en/ar/fr/es on TV | N-S3-T2 | [ ] OPEN — depends on F-S2-T6 |
| Desktop locale pass-through verified | N-S2-T2 | [ ] OPEN — depends on N-S3-T1 |
| TV store listing en/ar/fr/es + AR human review | N-S3-T4 | [ ] OPEN |
| Translation completeness CI gate (all surfaces) | N-S3-T3 | [~] PARTIAL — script added; CI job not yet wired |
| RTL automated test (web + desktop) | N-AUX-1 | [ ] OPEN |
| Desktop E2E test suite (≥5 tests in CI) | N-S2-T1 | [ ] OPEN — depends on E-wave2 |
| Mobile coverage gate ≥60% lines in CI | N-S3-T5 | [x] DONE — 62.98% lines; threshold configured in jest.config.js |
| Web coverage gate ≥60% lines in CI | D-S10-T2 | [ ] OPEN — currently 9.26% (page-layer coverage gap) |
| Mobile test suite: all 122 tests green | N | [x] DONE |
| Web test suite: all 82 tests green (incl. 5 axe tests) | N | [x] DONE |
| Brand audit (ɳ mark, color tokens, icon sizing) | N-S4-T1 | [ ] OPEN |
| Brand assets complete (see BRAND-ASSETS-NEEDED.md) | N-S4-T2 | [ ] OPEN — see gap list |

---

## Section I — CI/CD Green

| Gate | Ticket(s) | Status |
|---|---|---|
| All GitHub Actions workflows green | G | [ ] OPEN |
| Zero phantom Flutter/stale refs in CI | I | [x] DONE — Flutter eliminated (ASI) |
| Version lockstep across all surfaces | G | [ ] OPEN |

---

## Section J — Documentation & SOT

| Gate | Ticket(s) | Status |
|---|---|---|
| Zero Flutter/stale refs in docs | I | [ ] OPEN |
| SPORT matches reality (all surfaces, endpoints, components) | I | [ ] OPEN |
| End-user help center + per-surface getting-started + public changelog | M, I | [ ] OPEN |
| FEATURES.md / VISION.md updated with user approval | I | [ ] OPEN |

---

## Section K — Phase Exit Ritual

| Gate | Ticket(s) | Status |
|---|---|---|
| DQA (`/deep-qa`) — zero P0/P1 findings | N-AUX-3 | [ ] OPEN |
| SIEGE — green | N-AUX-3 | [ ] OPEN |
| Route audit: all SPORT F11 subdomains + api-routes.yaml return expected status | N-AUX-3 | [ ] OPEN |
| Doc-sync: web changelog/pricing/versions match SPORT F01/F07 at build time | N-AUX-3 | [ ] OPEN |
| User review of `QA-STRATEGY.md` | N-S5-T1 | [ ] OPEN |
| Beta/UAT checklist complete — no open P0/P1 failures | N-AUX-2 | [ ] OPEN |
| User explicit same-turn authorization for version bump + tag + release | N-AUX-3 | [ ] REQUIRED |

---

## N-AUX-3 Pre-Flight Commands

Run these immediately before submitting for user approval:

```bash
# 1. i18n completeness check
cd /path/to/ntask && pnpm i18n:check

# 2. Mobile tests + coverage
cd apps/mobile && pnpm test --coverage

# 3. Web tests
cd /path/to/web/ntask && pnpm test

# 4. Version lockstep
cd /path/to/ntask && bash scripts/check-version-lockstep.sh

# 5. Route audit (after backend is live on staging)
# curl all routes in .claude/docs/api-routes.yaml and SPORT F11

# 6. DQA
# /deep-qa

# 7. SIEGE
# (run SIEGE skill)
```

---

## Authorization Template (for user to fill in when ready)

```
AUTHORIZE P5 RC SIGN-OFF
Date: YYYY-MM-DD
Checked by: [name]
DQA result: PASS (zero P0/P1)
SIEGE result: PASS
Route audit: PASS
All DoD boxes checked: YES
Action: Authorize patch version bump + tag + GH Release + deploy-verify
```

---

## Open External Gates (Cannot Be Unblocked by Engineering Alone)

1. **App Store / Play Store approval** — external review queue (1–7 days)
2. **Apple TV parallax icon** — requires designer (3-layer Photoshop/Sketch deliverable)
3. **Third-party pentest** — external security firm engagement
4. **Arabic translation human review** — requires Arabic-speaking reviewer
5. **Brand source SVG** — requires designer delivery (see BRAND-ASSETS-NEEDED.md)
