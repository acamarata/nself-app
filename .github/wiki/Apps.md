# Apps

ɳTasks ships four client surfaces, all talking to the same Hasura GraphQL backend. This page is the honest, current status of each. For setup steps, follow the links to the per-surface pages.

## Web (task.nself.org)

**Status: Active.** This is the surface behind the hosted SaaS.

- Framework: React 19 + Vite 6 SPA
- Code lives in a separate repo: `web/ntask/` in `nself-org/web`, not in this repo (`ntask` ships the backend plus the mobile, desktop, and TV clients)
- Deployed to `task.nself.org` via Vercel
- Full feature set: lists, tasks, sharing, presence, smart views, MFA setup (Security tab), i18n (en/es/fr/ar)
- No web push notifications yet; the app uses in-app and email notifications instead

Setup: [[Web-SPA]]

## Desktop (macOS, Windows, Linux)

**Status: Shipped, but not code-signed yet.** The app builds and runs. Distributable installers are not notarized (macOS) or EV-signed (Windows) because those credentials aren't set up.

- Framework: Tauri 2, wrapping the same Vite frontend as the web app
- Bundle id `org.nself.ntask`, display name "ɳTasks"
- Real features working: OS-keychain-backed credential storage (via the `keyring` crate), an offline fallback screen when the backend is unreachable, Launch-at-Login, and an auto-updater with a real minisign signing key already wired into the build
- Opens on a chrome-free "Welcome" screen in app-mode (no browser header/footer/cookie banner)
- **What's blocking signed releases:** an Apple Developer ID certificate and a Windows EV certificate are not yet in GitHub Actions secrets. Until those land, distributable builds are unsigned/unnotarized. The updater's signing key itself is in place and CI-wired; it's the OS code-signing certs that are missing.

Build output:
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/msi/*.msi`
- Linux: `src-tauri/target/release/bundle/deb/*.deb`

Setup: [[Desktop]]

## Mobile (iOS, Android)

**Status: Android active, iOS blocked.**

- Framework: React Native 0.79 + Expo 53
- Android: an APK build is available and installable directly (`~/Desktop/nTask.apk` in dev builds; production builds go through EAS Build). This is the currently shippable path.
- iOS: the project now generates (`expo prebuild -p ios` produces a working Xcode project). Shipping to devices or TestFlight still needs an Apple Developer account and signing certificate, which is an account setup step rather than a code problem.
- Real features working: push notifications with actual device-token registration into `np_device_tokens` and tap-to-navigate from a notification, an offline mutation queue for task and list changes (create/update/toggle/delete, including subtasks), a server-URL switch so you can point the app at a self-hosted backend without reinstalling, and the Today/Overdue/Upcoming smart views
- MFA setup screen (`MfaSetupScreen`) is implemented and reflects the server-side `task_users.mfa_enabled` state
- i18n: en/es/fr/ar, including RTL for Arabic
- Test suite: several hundred Jest tests passing; Detox E2E tests exist but are skipped pending simulator provisioning

Setup: [[RN-Setup]]

## TV (Apple TV, Android TV)

**Status: Early preview / scaffolded.** Builds and runs locally. No store release has been made.

- Framework: react-native-tvos, isolated from the mobile app's regular React Native dependency (this was the main integration challenge, and it's solved)
- Scope is intentionally narrow: a read-focused, glanceable dashboard with Today, Overdue, and Calendar views, built for D-pad navigation
- i18n: en/es/fr/ar, shared locale files with mobile
- No EAS release build has been triggered yet, so there's no way to install this on a real Apple TV or Android TV device today outside of local development builds

Setup: [[TV]]

## Summary table

| Surface | Framework | Status | What's blocking full release |
|---|---|---|---|
| Web | React + Vite | Active | Nothing, it's live at task.nself.org |
| Desktop | Tauri 2 | Shipped, unsigned | Apple notarization cert, Windows EV cert |
| Mobile (Android) | React Native + Expo | Active | Nothing, APK available |
| Mobile (iOS) | React Native + Expo | Blocked | Apple Developer signing cert, `@xmldom/xmldom` dependency pin |
| TV | react-native-tvos | Early preview | EAS release build not yet triggered |

## Shared backend

All four surfaces connect to the same Hasura GraphQL API, either the hosted one at `task.nself.org` or a self-hosted one you run yourself. See [[Self-Hosting]] to run your own, or [[Backend-Architecture]] for how the backend is put together.

## Related

- [[Features]]: full feature inventory
- [[Self-Hosting]]: run your own backend
- [[Getting-Started]]: first run for any surface
- [[Deployment]]: staging and production deploy
