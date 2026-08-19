/**
 * Purpose: Update-available dialog for ɳTask desktop. Appears when the
 *          auto-updater finds a newer version. Wraps AutoUpdater from
 *          @nself/tauri-bridge. Hidden in browser context.
 * Inputs:  isTauri() — renders nothing in browser.
 *          AutoUpdater.check() — polls for update on mount.
 * Outputs: Modal dialog with Install Now / Later buttons.
 * Constraints: Downgrade guard is enforced on the Rust side (downgrade_guard.rs).
 *              This component handles UI only.
 * SPORT: no new entry (UI component, not a tracked service command).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri, AutoUpdater } from '../lib/tauri';
import type { UpdateManifest } from '../lib/tauri';

/** Discriminated-union shape returned by AutoUpdater.check(). */
type CheckResult =
  | { _tag: 'Ok'; value: UpdateManifest | null }
  | { _tag: 'Err'; error: unknown };

interface UpdatePromptProps {
  /** Optional callback after install is triggered (e.g. to show relaunch message). */
  onInstallStarted?: () => void;
}

export function UpdatePrompt({ onInstallStarted }: UpdatePromptProps): React.JSX.Element | null {
  const [update, setUpdate] = useState<UpdateManifest | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // AutoUpdater is a class — keep a stable instance per component mount.
  const updaterRef = useRef<AutoUpdater | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    // Secondary UI check — the primary check runs in lib.rs on launch.
    // This component allows the File → Help → Check for Updates menu item
    // to surface an update if the user dismisses the auto check.
    const updater = new AutoUpdater();
    updaterRef.current = updater;
    updater
      .check()
      .then((result: CheckResult) => {
        if (result._tag === 'Ok' && result.value) setUpdate(result.value);
      })
      .catch(() => {
        // Non-critical; silently ignore check failures in UI.
      });
  }, []);

  const handleInstall = useCallback(async () => {
    if (!update || !updaterRef.current) return;
    setInstalling(true);
    try {
      await updaterRef.current.downloadAndInstall();
      onInstallStarted?.();
    } catch (err) {
      console.error('[UpdatePrompt] install failed:', err);
      setInstalling(false);
    }
  }, [update, onInstallStarted]);

  if (!isTauri() || !update || dismissed) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-title"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-900 p-4 shadow-lg"
    >
      <h2 id="update-title" className="text-sm font-semibold text-foreground dark:text-white">
        Update Available
      </h2>
      <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400">
        ɳTask {update.version} is ready to install.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex-1 rounded bg-primary dark:bg-indigo-600 px-3 py-1.5 text-xs font-medium text-primary-foreground dark:text-white hover:dark:bg-indigo-700 disabled:opacity-50"
        >
          {installing ? 'Installing…' : 'Install Now'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          disabled={installing}
          className="rounded px-3 py-1.5 text-xs text-muted-foreground dark:text-gray-400 hover:bg-muted dark:hover:bg-gray-800"
        >
          Later
        </button>
      </div>
    </div>
  );
}
