# react-native-tvos Integration Spike — ɳTask TV

**Epic:** F — TV app  
**Date:** 2026-06-27  
**Branch:** p5/wave3-f-tv  
**Status:** Scaffold complete; EAS build not yet triggered (external gates below)

---

## 1. Package Isolation Strategy

### Problem
`react-native` and `react-native-tvos` cannot coexist in the same node_modules tree.
Standard `react-native` (0.79.x) is already a dependency of `apps/mobile`.
The workspace root must not hoist a conflicting version.

### Solution: Two-level override
Both levels are required together; either alone is insufficient.

**Level 1 — pnpm override (apps/tv/package.json):**
```json
"pnpm": {
  "overrides": {
    "react-native": "npm:react-native-tvos@^0.79.2-0"
  }
}
```
This tells pnpm's resolution engine to substitute `react-native-tvos` for `react-native`
within the `apps/tv` package scope. `apps/mobile` retains standard `react-native@0.79.7`.

**Level 2 — Metro extraNodeModules (metro.config.js):**
```js
config.resolver.extraNodeModules = {
  'react-native': require.resolve('react-native-tvos'),
};
```
Metro bundles by module name, not by the resolved package. Without this alias, Metro
resolves `import ... from 'react-native'` to the hoisted standard version even after
the pnpm override, causing a mismatch at runtime.

### Workspace verification (must run after adding apps/tv to workspace)
```bash
# Add apps/tv to pnpm-workspace.yaml, then:
pnpm install
node -e "require.resolve('react-native-tvos')" # should resolve
pnpm -C apps/tv ls react-native # should show react-native-tvos
```

### Known quirk: pnpm-lock.yaml conflict
Adding `apps/tv` to the workspace may update `pnpm-lock.yaml` with react-native-tvos.
The lockfile must be committed alongside the workspace change. CI uses `--frozen-lockfile`
so the lockfile update must land in the same commit as the workspace.yaml update.

---

## 2. Workspace YAML Update Required

`pnpm-workspace.yaml` currently only lists `apps/mobile`. It must be updated:

```yaml
packages:
  - 'apps/mobile'
  - 'apps/tv'
  - '../packages/@nself/*'
```

**This is a blocker for `pnpm install` to recognize apps/tv as a workspace package.**
The update was intentionally left out of this scaffold commit to avoid triggering
lockfile regeneration on a PR that may not yet have Apple TV provisioning.
**Do this when ready to activate the CI job.**

---

## 3. Focus Navigation Library Choice

### Options evaluated
| Option | Pros | Cons | Decision |
|---|---|---|---|
| `@react-navigation/tv` (unofficial) | Purpose-built for TV nav | Unmaintained, no types, archived 2024 | Rejected |
| `react-tv-space-navigation` | D-pad engine, spatial nav | Extra dep, complex config, may conflict with rn-tvos focus engine | Rejected for now |
| Built-in tvOS UIFocusEngine | Zero deps, system-native, batteries-included | Android TV needs manual `nextFocus*` props | **Selected** |

### Decision: Built-in + FocusContext
- tvOS: `isTVSelectable={true}` + `onFocus/onBlur` callbacks on `TouchableOpacity` → UIFocusEngine handles D-pad routing automatically.
- Android TV: explicit `nextFocusUp/Down/Left/Right` props + `nativeID` per element → manual routing, verbose but predictable on older Fire TV sticks.
- FocusContext: lightweight React context tracking `focusedId` for UI feedback (focus ring rendering) — NOT used for routing logic (UIFocusEngine owns that).

### Revisit
If spatial navigation across a grid of GlanceCards proves problematic, evaluate
`react-tv-space-navigation` as a drop-in for the Dashboard grid only.

---

## 4. EAS tvOS Build Requirements

EAS tvOS builds require:
- `eas.json` `tvos` profile with `ios.resourceClass: m-medium`
- `app.json` `ios.isTV: true` + `ios.bundleIdentifier: org.nself.ntask.tv`
- Apple TV provisioning profile in EAS (separate from iOS mobile profile)

All three are configured in this scaffold. **What remains externally:**
1. Apple Developer account: create App ID `org.nself.ntask.tv` with tvOS platform enabled
2. EAS project: register `ntask-tv` project ID via `eas init`
3. EAS secret: `EXPO_APPLE_ID`, `EXPO_APPLE_TEAM_ID` in EAS project environment

---

## 5. Android TV Requirements

- `app.json` `android.isTV: true` + `uses-feature: leanback` (configured)
- `android.banner: ./assets/android-tv-banner.png` — **must be 1280×720 PNG before EAS build**
- Amazon Fire TV: same APK, separate submission track in Amazon Developer Console

---

## 6. Real Device Testing

EAS Go does not support tvOS. Testing path:
- **Simulator:** `eas build --profile development --platform ios` → install on Apple TV Simulator
- **Device:** EAS build `tvos` profile → TestFlight (internal) → Apple TV device
- **Android TV:** `eas build --profile android-tvos` → sideload APK via ADB

Command to sideload on Android TV:
```bash
adb connect <android-tv-ip>:5555
adb install ntask-tv.apk
```

---

## 7. Asset Placeholders

The following asset files are stubs (1×1 transparent PNG not created — must be replaced before EAS build):
- `assets/icon.png` — tvOS home screen icon (requires layered format for tvOS parallax: not a flat PNG)
- `assets/splash.png` — launch screen
- `assets/adaptive-icon.png` — Android TV adaptive icon foreground
- `assets/android-tv-banner.png` — **1280×720 mandatory for Google Play / Fire TV submission**
- `assets/top-shelf.png` — Apple TV top shelf image (optional but recommended)

Flag for brand pass (coordinate with `upbrand` skill or brand designer).

**Build will fail at the EAS native compilation step if these are missing.**
For the CI typecheck/lint/test job (tvos-ci.yml), no assets are needed.

---

## 8. Summary of External Gates

| Gate | Owner | Blocker for |
|---|---|---|
| Update pnpm-workspace.yaml + regenerate lockfile | Dev | `pnpm install` in CI |
| Apple TV App ID + provisioning profile | Apple account holder | EAS tvOS build |
| EAS project registration (`eas init`) | EAS account | EAS build |
| Android TV banner asset (1280×720) | Brand | Android TV APK |
| All other brand assets (icon, splash, top-shelf) | Brand | Native build |
| Amazon Developer Console app registration | Amazon | Fire TV submission |
| Google Play TV track app registration | Google | Android TV submission |
| Real tvOS device (Apple TV 4K) for manual testing | QA | Verification |
