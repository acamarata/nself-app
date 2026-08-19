/**
 * Purpose: Core of the self-contained Tauri 2 bridge — Result monad, AppError,
 *          environment detection (isTauri), TauriBridge, and typed invoke().
 *          In the browser: isTauri() returns false; all Tauri APIs are inert stubs.
 *          At runtime inside Tauri: dynamic imports of @tauri-apps/* are executed
 *          behind isTauri() guards — no build-time hard dependency on those packages.
 * Inputs:  None — pure environment-detect + optional dynamic import.
 * Outputs: Result/ok/errResult/isErr, AppError, notTauriError, isTauri, TauriBridge,
 *          bridge, invoke — consumed by the sibling tauri/* modules and the barrel.
 * Constraints: NEVER import @tauri-apps/* or @nself/tauri-bridge at the module's top
 *              level — only inside isTauri()-gated dynamic import() calls.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */

// ─── Minimal Result monad (replaces @nself/errors dependency) ────────────────
// Inlined to avoid needing another vite alias for @nself/errors.

export type Ok<T> = { readonly _tag: 'Ok'; readonly value: T };
export type Err<E> = { readonly _tag: 'Err'; readonly error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { _tag: 'Ok', value };
}
export function errResult<E>(error: E): Err<E> {
  return { _tag: 'Err', error };
}
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result._tag === 'Err';
}

// ─── AppError (subset used by bridge) ────────────────────────────────────────

export interface AppError {
  code: string;
  message: string;
  status: number;
}

export function notTauriError(): AppError {
  return {
    code: 'internal',
    message: 'not-tauri: operation requires the Tauri desktop runtime',
    status: 500,
  };
}

// ─── Environment detection ────────────────────────────────────────────────────

/**
 * Returns true only when executing inside a Tauri 2 webview.
 * Uses the canonical __TAURI__ sentinel (set by Tauri 2 before JS runs).
 */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI__' in window &&
    (window as Record<string, unknown>)['__TAURI__'] !== undefined
  );
}

// ─── TauriBridge ─────────────────────────────────────────────────────────────

/**
 * TauriBridge — root abstraction for Tauri 2 interactions.
 * Provides isTauri detection and stub behaviour outside the desktop runtime.
 */
export class TauriBridge {
  readonly isDesktop: boolean;

  constructor() {
    this.isDesktop = isTauri();
  }

  stubErr<T>(): Result<T, AppError> {
    return errResult(notTauriError());
  }
}

/** Singleton bridge instance. */
export const bridge = new TauriBridge();

// ─── invoke ──────────────────────────────────────────────────────────────────

/**
 * invoke<T> — typed Tauri IPC command caller.
 *
 * Returns Promise<Result<T, AppError>> (never rejects). Consumers can safely
 * chain .catch() — it will never fire because errors are returned as Err values.
 * Dynamic import of @tauri-apps/api/core happens only inside Tauri at runtime.
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<Result<T, AppError>> {
  if (!isTauri()) {
    return errResult(notTauriError());
  }

  try {
    // Dynamic import keeps @tauri-apps/api out of browser bundles entirely.
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    const result = await tauriInvoke<T>(command, args);
    return ok(result);
  } catch (raw: unknown) {
    const message =
      raw instanceof Error
        ? raw.message
        : typeof raw === 'string'
          ? raw
          : 'unknown tauri invoke error';
    return errResult<AppError>({
      code: 'internal',
      message: `tauri:${command}: ${message}`,
      status: 500,
    });
  }
}
