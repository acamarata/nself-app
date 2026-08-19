/**
 * InstallPrompt.tsx — PWA "Add to Home Screen" banner
 *
 * Purpose:    Show install banner when browser fires beforeinstallprompt.
 *             User can install the PWA or dismiss the prompt.
 * Inputs:     beforeinstallprompt browser event
 * Outputs:    Install banner visible when installable; hidden otherwise
 * Constraints: localStorage key 'ntask-pwa-dismissed' persists dismissal
 * SPORT:      D-S8-T1
 */
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('ntask-pwa-dismissed') === '1'
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    window.localStorage.setItem('ntask-pwa-dismissed', '1')
  }

  return (
    <div
      role="banner"
      className="fixed bottom-20 left-4 right-4 z-50 lg:left-auto lg:right-4 lg:w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Install ɳTask</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Add to your home screen for offline access
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
          aria-label="Dismiss install prompt"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
