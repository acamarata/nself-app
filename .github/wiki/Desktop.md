# Desktop Setup (ɳTasks)

Setup guide for the Tauri 2 desktop app (`apps/desktop/`).

> **Status: Planned — Epic E.** This guide reflects the intended setup; some sections are stubs pending Epic E completion.

## Overview

The desktop app is a Tauri 2 wrapper around the Vite web SPA (`apps/web/`). It shares the same React 19 codebase, bundled into a native shell for macOS, Windows, and Linux.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 20+ | JS/TS runtime |
| pnpm | 10+ | Package manager |
| Rust (rustup) | Latest stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| XCode CLI | Latest | macOS builds (`xcode-select --install`) |
| MSVC | Latest | Windows builds (Visual Studio Build Tools) |

Install Tauri CLI:
```bash
cargo install tauri-cli
```

## Environment Config

```bash
cd apps/desktop
cp .env.example .env.local
```

Desktop uses the same env vars as `apps/web/` (VITE_* vars) — Tauri embeds the Vite frontend.

## Run (Development)

Start the backend first:
```bash
cd backend && make up
```

Then start Tauri dev mode:
```bash
cd apps/desktop
pnpm tauri dev   # Starts Vite frontend + Tauri native shell
```

## Build

```bash
cd apps/desktop
pnpm tauri build   # Produces platform installer
```

Output:
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/msi/*.msi`
- Linux: `src-tauri/target/release/bundle/deb/*.deb`

## Related

- [Monorepo-Setup](Monorepo-Setup): workspace layout
- [Web-SPA](Web-SPA): the Vite frontend embedded in this app
- [Backend-Setup](Backend-Setup): backend setup
- [Deployment](Deployment): release guide
