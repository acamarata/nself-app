/**
 * Purpose: AutoUpdater — check for, download, and install app updates via
 *          tauri-plugin-updater.
 * Inputs:  @tauri-apps/plugin-updater via runtime dynamic import (desktop only).
 * Outputs: AutoUpdater class + UpdateManifest type; Result values (Err in browser).
 * Constraints: NEVER import @tauri-apps/* at top level — only inside
 *              isTauri()-gated dynamic import() calls.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */
import { errResult, isTauri, notTauriError, ok } from './core';
import type { AppError, Result } from './core';

/**
 * Canonical update manifest shape returned by AutoUpdater.check().
 * Maps tauri-plugin-updater Update to a stable nSelf interface.
 */
export interface UpdateManifest {
  /** New version string (semver). */
  version: string;
  /** Release notes (may be markdown). */
  body: string | null;
  /** Publication date string. */
  date: string | null;
}

/**
 * AutoUpdater — check for, download, and install app updates.
 * check() returns Result<UpdateManifest | null, AppError> — consumers narrow
 * with `result._tag === 'Ok'`.
 */
export class AutoUpdater {
  private pendingUpdate: unknown | null = null;

  async check(): Promise<Result<UpdateManifest | null, AppError>> {
    if (!isTauri()) return errResult(notTauriError());

    try {
      // Desktop-only runtime dep — not installed in web workspace; only reached inside Tauri.
      // Built from a variable (not a literal) so Vite's import-analysis plugin
      // can't eagerly resolve it at transform time (breaks Vitest/dev builds
      // even behind the isTauri() guard above, since it's a static string scan).
      const updaterSpecifier = '@tauri-apps/plugin-updater';
      const { check } = await import(/* @vite-ignore */ updaterSpecifier);
      const update = await check();

      if (!update?.available) {
        this.pendingUpdate = null;
        return ok(null);
      }

      this.pendingUpdate = update;
      return ok({
        version: update.version,
        body: update.body ?? null,
        date: update.date ?? null,
      });
    } catch (raw: unknown) {
      return errResult(toUpdaterError('check', raw));
    }
  }

  async downloadAndInstall(): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());

    if (this.pendingUpdate === null) {
      return errResult({
        code: 'internal',
        message: 'updater: no pending update — call check() first',
        status: 500,
      });
    }

    try {
      const update = this.pendingUpdate as { downloadAndInstall: () => Promise<void> };
      await update.downloadAndInstall();
      this.pendingUpdate = null;
      return ok(undefined);
    } catch (raw: unknown) {
      return errResult(toUpdaterError('downloadAndInstall', raw));
    }
  }
}

function toUpdaterError(op: string, raw: unknown): AppError {
  const message = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : 'unknown';
  return { code: 'internal', message: `updater:${op}: ${message}`, status: 500 };
}
