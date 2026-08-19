/**
 * Purpose: openUrl — open a URL in the system browser with allowlist enforcement.
 * Inputs:  URL string + hostname allowlist; @tauri-apps/plugin-opener via runtime
 *          dynamic import (desktop only).
 * Outputs: Result<void, AppError> (Err in browser context).
 * Constraints: NEVER import @tauri-apps/* at top level — only inside
 *              isTauri()-gated dynamic import() calls.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */
import { errResult, isTauri, notTauriError, ok } from './core';
import type { AppError, Result } from './core';

/**
 * openUrl — open a URL in the system browser with allowlist enforcement.
 * Returns Err immediately in browser context (no Tauri runtime).
 */
export async function openUrl(
  url: string,
  allowlist: string[],
): Promise<Result<void, AppError>> {
  if (!isTauri()) return errResult(notTauriError());

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return errResult({
      code: 'validation_error',
      message: `shell:openUrl: invalid URL: ${url}`,
      status: 422,
    });
  }

  if (!allowlist.includes(parsed.hostname)) {
    return errResult({
      code: 'forbidden',
      message: `shell:openUrl: hostname '${parsed.hostname}' is not in the allowlist`,
      status: 403,
    });
  }

  try {
    // Desktop-only runtime dep — not installed in web workspace; only reached inside Tauri.
    // Built from a variable (see AutoUpdater.check()) so Vite's import-analysis
    // plugin can't eagerly resolve it at transform time.
    const openerSpecifier = '@tauri-apps/plugin-opener';
    const { openUrl: tauriOpenUrl } = await import(/* @vite-ignore */ openerSpecifier);
    await tauriOpenUrl(url);
    return ok(undefined);
  } catch (raw: unknown) {
    const message = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : 'unknown';
    return errResult({ code: 'internal', message: `shell:openUrl: ${message}`, status: 500 });
  }
}
