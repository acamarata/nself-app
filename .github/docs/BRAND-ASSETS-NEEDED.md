# ɳTasks Brand Asset Inventory — P5 Gap Audit

**Status:** DESIGN GATE — items marked NEEDED require real design work before store submission.  
**Audit date:** 2026-06-27  
**Owner ticket:** N-S4-T2  
**Brand guide:** `.claude/docs/brand/brand-guide.md` (canonical source for ɳ mark, color palette, icon rules)

---

## CRITICAL: What This Document Is

This file lists brand assets that:
- Exist but are **unbranded placeholders** (generic Expo defaults, white squares, etc.)
- Are **missing entirely** and must be created before store submission
- Have **wrong dimensions** for their required platform slot

**Do NOT fabricate brand art without the source files in `.claude/docs/brand/`.** File a PCI if source files are missing before regenerating.

---

## Legend

| Status | Meaning |
|---|---|
| `NEEDED` | Missing or confirmed placeholder — requires designer action |
| `PARTIAL` | Exists but wrong dimensions or unbranded |
| `OK` | Correct dimensions and uses canonical ɳ mark + sky-blue palette |
| `EXTERNAL GATE` | Cannot be unblocked by engineering — requires design delivery |

---

## Surface 1: Mobile (iOS + Android)

Path: `apps/mobile/assets/`

| Asset | Required spec | Current state | Status |
|---|---|---|---|
| App icon (master) | 1024×1024 PNG, no alpha, ɳ mark sky-blue on dark bg | `icon.png` — 1024×1024 exists | PARTIAL — unverified if branded |
| iOS App Store icon | 1024×1024 PNG (generated from master via EAS) | Derived from `icon.png` | PARTIAL |
| Android adaptive icon (foreground) | 1024×1024 PNG with safe-zone padding | `adaptive-icon.png` — 1024×1024 exists | PARTIAL — unverified branding |
| Android adaptive icon (background) | Solid sky-blue `#0ea5e9` or branded color PNG | Not in assets/ — uses Expo default white | NEEDED |
| Splash screen (iOS) | 2048×2048 PNG, ɳ mark centered on gray-950 `#030712` bg | `splash.png` — 2048×2048 exists | PARTIAL — likely Expo default |
| Splash screen (Android) | Uses `expo-splash-screen`, same source as iOS | Derived from `splash.png` | PARTIAL |
| iOS store screenshots | 6.9" 1320×2868 (required), 6.7", 5.5", iPad Pro | None committed to repo | NEEDED |
| Android store screenshots | Phone 1080×1920 min | None committed to repo | NEEDED |
| Google Play feature graphic | 1024×500 JPG/PNG | None | NEEDED |

**EXTERNAL GATE: iOS/Android app icon + splash require designer delivery of:**
- ɳ mark (eta, Unicode U+0273) on gray-950 background, sky-blue gradient (`#AAE4FF → #38BDF8`)
- Source SVG in `.claude/docs/brand/svg/ntask-icon.svg` before PNG rasterization

---

## Surface 2: Web SaaS (task.nself.org)

Path: `web/ntask/public/`

| Asset | Required spec | Current state | Status |
|---|---|---|---|
| `favicon.ico` | 16×16 + 32×32 multi-size | `favicon.ico` — 48×48 only | PARTIAL (resize needed) |
| `favicon-16x16.png` | 16×16 PNG | `favicon-16x16.png` — exists | OK (verify branding) |
| `apple-touch-icon.png` | 180×180 PNG | `apple-touch-icon.png` — exists | OK (verify branding) |
| `icon-192.png` | 192×192 PNG | `icon-192.png` — 192×192 RGBA exists | OK (verify branding) |
| `icon-512.png` | 512×512 PNG | `icon-512.png` — 512×512 RGBA exists | OK (verify branding) |
| `icon-maskable-512.png` | 512×512 PNG, safe-zone center (PWA maskable) | **MISSING** | NEEDED |
| `og-default.png` | 1200×630 PNG, ɳTasks wordmark on gray-950 bg | **MISSING** | NEEDED |
| Per-list OG image (dynamic) | 1200×630, dynamic via `api/og.ts` stub | Stub exists but not wired | NEEDED (D5 ticket) |
| `site.webmanifest` | PWA manifest with icons + theme_color | `manifest.json` exists | OK |
| Logo wordmark (horizontal) | `logo-horizontal-{light,dark}.png` — ɳ + "Tasks" | **MISSING** — only inherits nSelf org logo | NEEDED |

**EXTERNAL GATE:**
- OG image (1200×630) with ɳTasks wordmark
- Maskable PWA icon (safe-zone center 40% of canvas)

---

## Surface 3: Desktop (Tauri 2)

Path: `apps/desktop/src-tauri/icons/`

| Asset | Required spec | Current state | Status |
|---|---|---|---|
| App icon (macOS `.icns`) | 1024×1024 source → `.icns` bundle | `icon.icns` — exists | PARTIAL — verify branding |
| App icon (Windows `.ico`) | 16–256px multi-size `.ico` | `icon.ico` — exists | PARTIAL — verify branding |
| `128x128.png` | 128×128 PNG | `128x128.png` — exists | PARTIAL |
| `128x128@2x.png` | 256×256 PNG (2x retina) | `128x128@2x.png` — exists | PARTIAL |
| `32x32.png` | 32×32 PNG | `32x32.png` — exists | PARTIAL |
| Tray icon (connected) | 16×16 or 22×22 PNG, monochrome for system tray | `tray-connected.png` — exists | PARTIAL |
| Tray icon (offline) | Same spec | `tray-offline.png` — exists | PARTIAL |
| Tray icon (syncing) | Same spec, animated or alternate frame | `tray-syncing.png` — exists | PARTIAL |
| macOS App Store screenshots | 2880×1800 Retina (min 3) | **MISSING** | NEEDED |
| Windows Store screenshots | 1366×768 min (min 2) | **MISSING** | NEEDED |
| Microsoft Store icon | 300×300 PNG | **MISSING** | NEEDED |

**EXTERNAL GATE:** All desktop tray + dock icons need branded ɳ mark verification against visual mockup. If Tauri default icons were used, regenerate from brand source SVG.

---

## Surface 4: TV (rn-tvos)

Path: `apps/tv/assets/`

| Asset | Required spec | Current state | Status |
|---|---|---|---|
| App icon (general) | 1024×1024 PNG base | `icon.png` — exists | PARTIAL — likely Expo default |
| Splash screen | 1920×1080 PNG | `splash.png` — exists | PARTIAL |
| Adaptive icon | 1024×1024 PNG | `adaptive-icon.png` — exists | PARTIAL |
| Android TV banner | 1280×720 PNG, MUST include app name text | `android-tv-banner.png` — exists | PARTIAL — verify text |
| tvOS App Store icon (large) | 1280×768 (top-shelf image, parallax layers) | **MISSING** | NEEDED |
| tvOS App Store icon (small) | 400×240 | **MISSING** | NEEDED |
| tvOS parallax icon layers | 3 layers (background/middle/foreground), each 1280×768 | **MISSING** | NEEDED |
| Apple TV marketing artwork | 2320×1740 | **MISSING** | NEEDED |
| Google TV feature banner | 1024×500 | **MISSING** | NEEDED |

**EXTERNAL GATE:** tvOS parallax icon is a 3-layer Photoshop deliverable — requires designer. Apple TV App Store will reject single-layer icons.

---

## Missing Assets Summary

| Priority | Asset | Surface | Blocker |
|---|---|---|---|
| P0 | tvOS parallax icon (3 layers) | TV | Apple TV store submission |
| P0 | iOS/Android store screenshots | Mobile | App Store / Play Store submission |
| P0 | OG image 1200×630 | Web | Social sharing, SEO |
| P1 | Maskable PWA icon (512×512) | Web | PWA installation on Android |
| P1 | Android TV banner (with name text) | TV | Google Play TV submission |
| P1 | macOS App Store screenshots | Desktop | Mac App Store submission |
| P1 | Windows Store screenshots + icon | Desktop | Microsoft Store submission |
| P2 | ɳTasks wordmark (horizontal + stacked) | Web, Desktop | Marketing, footer logos |
| P2 | Email header logo | Web backend | Transactional emails |

---

## Assets That Exist But Need Visual Verification

The following assets exist at correct dimensions but have not been confirmed to use the canonical ɳ mark (sky-blue gradient on gray-950) vs generic Expo defaults:

- `apps/mobile/assets/icon.png` (1024×1024)
- `apps/mobile/assets/splash.png` (2048×2048)  
- `apps/tv/assets/icon.png`
- `apps/desktop/src-tauri/icons/icon.icns`
- `web/ntask/public/icon-192.png` + `icon-512.png`

**Action:** Open each in Preview/Finder and verify the ɳ mark is visible with sky-blue color. If the icon shows an "n" in a generic color, it needs regeneration from brand source SVG.

---

## How to Unblock

1. Designer delivers source SVG: `.claude/docs/brand/svg/ntask-icon.svg` (ɳ mark, sky-blue gradient)
2. Use `pnpm --filter ntask-mobile expo prebuild` to regenerate iOS/Android icons from 1024×1024 master
3. Use `pnpm tauri icon path/to/1024.png` to regenerate all Tauri sizes from master
4. Manually create OG (1200×630) and maskable PWA icon from brand source

**PCI to file if source SVG is missing:** `pci-send nself brand-assets-ntask high enhancement "Deliver ɳTasks brand source SVG for icon generation"`
