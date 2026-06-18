# ɳTasks Testing Guide

## Overview

ɳTasks uses a three-layer test pyramid: unit, integration, and e2e. The Flutter legacy app (`app/`) uses `flutter test`; the React Native mobile app (`apps/mobile/`) uses jest-expo.

---

## React Native App (`apps/mobile/`)

### Unit + Integration tests — jest-expo

**Stack:** `jest-expo` preset · `@testing-library/react-native` · `MSW` for GraphQL mocks.

**Run locally:**

```bash
cd apps/mobile
pnpm test               # run once
pnpm test -- --watch    # watch mode
pnpm test -- --coverage # coverage report (>= 80% line required)
```

**CI gate:**

```bash
make ci-local   # runs flutter analyze + flutter test + RN lint + typecheck + jest
make ci-local-rn  # RN mobile only
```

**Config:** `apps/mobile/jest.config.js` (preset: jest-expo, pnpm-aware transformIgnorePatterns).

**Test locations:**

| Directory | What's tested |
|-----------|--------------|
| `apps/mobile/__tests__/` | hooks, utilities, auth, validation, offline queue |

**Coverage:** `pnpm test -- --coverage` must report `>= 80% line` on TS source files.

---

### E2E tests — Detox

**Framework:** Detox (iOS + Android simulator).

**Note:** E2E tests are currently `.skip`'d pending simulator provisioning in local CI. See `.claude/inbox/pci-native-simulator-detox.md`.

**Run manually (simulator required):**

```bash
cd apps/mobile
pnpm e2e:ios      # iOS simulator
pnpm e2e:android  # Android emulator
```

**Test location:** `apps/mobile/e2e/taskFlow.e2e.ts` — covers create → list → complete task flow.

---

## Flutter App (`app/`)

**Run tests:**

```bash
cd app
flutter test
flutter analyze --no-pub
```

---

## CI Gate Summary

| App | Gate command | What runs |
|-----|-------------|-----------|
| `apps/mobile/` | `make ci-local-rn` | lint + typecheck + jest (no simulator) |
| `app/` | `make ci-local` | flutter analyze + flutter test |
| Both | `make ci-local` | all of the above |

E2E (Detox) is NOT part of `make ci-local` — requires a separate simulator session.
