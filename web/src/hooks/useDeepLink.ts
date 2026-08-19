/**
 * Purpose: Listen for ntask:// deep link events from the Tauri runtime and
 *          route the SPA to the appropriate page. Guards safely in browser.
 * Inputs:  Deep link URL string emitted by Rust lib.rs "deep-link" event.
 * Outputs: Side effect — calls navigate() with parsed path.
 * Constraints: Must guard with isTauri(). Second-instance prevention is
 *              handled by tauri-plugin-deep-link automatically.
 * URL patterns:
 *   ntask://             → navigate('/')
 *   ntask://task/<id>    → navigate('/task/<id>')
 *   ntask://list/<id>    → navigate('/list/<id>')
 *   ntask://settings     → navigate('/settings')
 * SPORT: no new entry (routing behaviour, not a tracked service command).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTauri } from '../lib/tauri';

// Tauri event listener API — only imported in Tauri context.
// Dynamic import prevents build errors in browser-only bundles.
async function listenTauri(
  event: string,
  handler: (payload: string) => void,
): Promise<(() => void) | null> {
  if (!isTauri()) return null;
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<string>(event, (e) => handler(e.payload));
  return unlisten;
}

/**
 * Parse a ntask:// deep link URL into a react-router path.
 * Returns '/' for unknown or malformed URLs (safe default: show home).
 */
function parsePath(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'ntask:') return '/';
    const host = parsed.hostname;   // "task", "list", "settings", ""
    const id = parsed.pathname.replace(/^\//, '');

    if (!host || host === '') return '/';
    if (host === 'settings') return '/settings';
    if ((host === 'task' || host === 'list') && id) return `/${host}/${id}`;
    if (host === 'task' || host === 'list') return `/${host}`;
    return '/';
  } catch {
    return '/';
  }
}

/** Register deep link event listener. Mount once at the app root in Tauri context. */
export function useDeepLink(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listenTauri('deep-link', (url: string) => {
      const path = parsePath(url);
      navigate(path, { replace: false });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [navigate]);
}
