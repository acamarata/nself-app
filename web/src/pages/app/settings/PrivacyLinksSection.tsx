/**
 * PrivacyLinksSection.tsx — footer legal links in Settings
 *
 * Purpose:    Renders Privacy Policy + Terms of Service anchor links pointing
 *             to nself.org canonical pages. Satisfies J-S1-T3 in-app link req.
 * Inputs:     none
 * Outputs:    Two external links (noopener, new tab)
 * Constraints: No router — these are external URLs. Kept as plain <a> tags.
 * SPORT:      J-S1-T3
 */
import { useT } from '@/lib/i18n'

export function PrivacyLinksSection() {
  const t = useT('tasks')
  return (
    <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 justify-center">
      <a
        href="https://nself.org/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
      >
        {t('account.privacy')}
      </a>
      <span className="text-xs text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
      <a
        href="https://nself.org/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
      >
        {t('account.terms')}
      </a>
    </div>
  )
}
