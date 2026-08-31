/**
 * AccessibilityPage.tsx — /accessibility — WCAG 2.1 AA conformance statement
 *
 * Purpose:    Ported from the retired web/ntask-marketing app's
 *             src/pages/accessibility.astro per ADR-P6-04. This statement is
 *             specific to task.nself.org (conformance status, known gaps) —
 *             distinct from nself.org's company-wide accessibility legal
 *             page, so it is fully ported rather than redirected.
 * Inputs:     none
 * Outputs:    static accessibility statement
 * SPORT:      P6-E7-W4-S1-T5
 */

export function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold">Accessibility</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">Last reviewed: 2026-06-27</p>

        <div className="mt-10 space-y-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-6">
          <p>ɳSelf is committed to ensuring that ɳTask and this site are accessible to people with disabilities.</p>

          <div>
            <h2>Conformance status</h2>
            <p>We target WCAG 2.1 Level AA conformance for task.nself.org. Current status: partially conforming — some content may not yet meet all criteria.</p>
          </div>

          <div>
            <h2>Measures taken</h2>
            <ul>
              <li>Skip-to-content link on every page</li>
              <li>Semantic HTML landmarks (main, nav, footer)</li>
              <li>ARIA labels on interactive elements</li>
              <li>Keyboard navigation supported throughout</li>
              <li>Sufficient color contrast (4.5:1 minimum for body text)</li>
              <li>Focus indicators visible at all times</li>
              <li>No auto-playing media</li>
            </ul>
          </div>

          <div>
            <h2>Known gaps</h2>
            <ul>
              <li>OG images do not yet have equivalent alt text in a text-only version of the page</li>
              <li>Some interactive components may not have been tested with all screen readers</li>
            </ul>
          </div>

          <div>
            <h2>Feedback</h2>
            <p>If you find an accessibility barrier on this site, email hello@nself.org with subject "Accessibility issue — task.nself.org". We aim to respond within 3 business days.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
