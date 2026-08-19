/**
 * Purpose: WindowManager — create and control named Tauri webview windows.
 * Inputs:  Window label + URL; @tauri-apps/api/webviewWindow via runtime dynamic import.
 * Outputs: WindowManager class returning Result values (Err in browser context).
 * Constraints: NEVER import @tauri-apps/* at top level — only inside
 *              isTauri()-gated dynamic import() calls.
 * SPORT: F13-CROSS-REPO-DEPS — replaces E-S1-T3 dep edge (web/ntask → @nself/tauri-bridge).
 */
import { errResult, isTauri, notTauriError, ok } from './core';
import type { AppError, Result } from './core';

/** Minimal interface for the @tauri-apps/api WebviewWindow surface we need. */
interface WebviewWindowLike {
  label: string;
  setFocus(): Promise<void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  once(event: string, handler: () => void): Promise<() => void>;
}

/**
 * WindowManager — create and control named Tauri webview windows.
 * All methods return Err immediately in browser context (no runtime).
 */
export class WindowManager {
  private readonly refs = new Map<string, WebviewWindowLike>();

  async create(label: string, url: string): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());

    const existing = this.refs.get(label);
    if (existing) {
      await existing.setFocus();
      return ok(undefined);
    }

    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = new WebviewWindow(label, { url });
      await win.once('tauri://destroyed', () => { this.refs.delete(label); });
      this.refs.set(label, win as unknown as WebviewWindowLike);
      return ok(undefined);
    } catch (raw: unknown) {
      return errResult(toWindowError('create', label, raw));
    }
  }

  async focus(label: string): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());
    const win = this.refs.get(label);
    if (!win) return errResult(notFoundWindowError(label));
    try { await win.setFocus(); return ok(undefined); }
    catch (raw: unknown) { return errResult(toWindowError('focus', label, raw)); }
  }

  async minimize(label: string): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());
    const win = this.refs.get(label);
    if (!win) return errResult(notFoundWindowError(label));
    try { await win.minimize(); return ok(undefined); }
    catch (raw: unknown) { return errResult(toWindowError('minimize', label, raw)); }
  }

  async maximize(label: string): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());
    const win = this.refs.get(label);
    if (!win) return errResult(notFoundWindowError(label));
    try { await win.maximize(); return ok(undefined); }
    catch (raw: unknown) { return errResult(toWindowError('maximize', label, raw)); }
  }

  async close(label: string): Promise<Result<void, AppError>> {
    if (!isTauri()) return errResult(notTauriError());
    const win = this.refs.get(label);
    if (!win) return errResult(notFoundWindowError(label));
    try {
      await win.close();
      this.refs.delete(label);
      return ok(undefined);
    } catch (raw: unknown) { return errResult(toWindowError('close', label, raw)); }
  }

  openLabels(): string[] {
    return Array.from(this.refs.keys());
  }
}

function notFoundWindowError(label: string): AppError {
  return { code: 'not_found', message: `window '${label}' not found in WindowManager`, status: 404 };
}

function toWindowError(op: string, label: string, raw: unknown): AppError {
  const message = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : 'unknown';
  return { code: 'internal', message: `window:${op}:${label}: ${message}`, status: 500 };
}
