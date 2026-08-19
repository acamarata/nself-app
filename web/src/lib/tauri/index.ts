/**
 * Purpose: Barrel for the self-contained Tauri 2 bridge for the ɳTask web/SaaS build.
 *          Provides the same exports previously re-exported from @nself/tauri-bridge
 *          but with NO build-time dependency on that external package. Split into
 *          core/windows/updater/opener/secure-store per the ASI 300-line file cap.
 *          In the browser: isTauri() returns false; all Tauri APIs are inert stubs.
 *          At runtime inside Tauri: dynamic imports of @tauri-apps/* are executed
 *          behind isTauri() guards — no build-time hard dependency on those packages.
 *          The desktop app (apps/desktop) wraps this same web build; the runtime
 *          dynamic imports work there because the Tauri webview provides the modules.
 * Inputs:  None — pure environment-detect + optional dynamic import.
 * Outputs: isTauri, invoke, bridge, TauriBridge, WindowManager, AutoUpdater, openUrl,
 *          TauriSecureStore, SecureStoreError, UpdateManifest (type), SecureStoreInterface (type).
 * Constraints: Export names and shapes must remain identical to @nself/tauri-bridge so
 *              consumers (TitleBarSyncStatus, UpdatePrompt, useTrayStatus) need zero changes.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */

export { isTauri, invoke, bridge, TauriBridge } from './core';
export { WindowManager } from './windows';
export { AutoUpdater } from './updater';
export type { UpdateManifest } from './updater';
export { openUrl } from './opener';
export { TauriSecureStore, SecureStoreError } from './secure-store';
export type { SecureStoreInterface } from './secure-store';
