/**
 * SecurityPage.tsx — /security — responsible disclosure policy
 *
 * Purpose:    Ported from the retired web/ntask-marketing app's
 *             src/pages/security.astro per ADR-P6-04. Scoped to
 *             task.nself.org + the ntask apps + the nSelf CLI/plugins it
 *             uses — distinct from org's generic CLI security docs, so it
 *             is fully ported rather than redirected.
 * Inputs:     none
 * Outputs:    static responsible-disclosure page
 * SPORT:      P6-E7-W4-S1-T5
 */

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold">Security</h1>

        <div className="mt-10 space-y-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-6">
          <div>
            <h2>Responsible Disclosure</h2>
            <p>We take security seriously. If you discover a vulnerability in ɳTask (app, backend, or this website), please report it privately before public disclosure.</p>
          </div>

          <div>
            <h2>How to Report</h2>
            <ul>
              <li>Email: security@nself.org (PGP key available on request)</li>
              <li><code>.well-known/security.txt</code> is available at task.nself.org/.well-known/security.txt</li>
            </ul>
          </div>

          <div>
            <h2>What to Include</h2>
            <ul>
              <li>Description of the vulnerability and affected component</li>
              <li>Steps to reproduce</li>
              <li>Potential impact</li>
              <li>Your contact information (optional)</li>
            </ul>
          </div>

          <div>
            <h2>Response Timeline</h2>
            <ul>
              <li>Acknowledgement: within 48 hours</li>
              <li>Triage and severity assessment: within 5 business days</li>
              <li>Fix timeline communicated: within 10 business days</li>
            </ul>
          </div>

          <div>
            <h2>Scope</h2>
            <p>In scope: task.nself.org (cloud service), ɳTask mobile and desktop apps (nself-org/ntask), and the nSelf CLI and plugins used by ntask.</p>
          </div>

          <div>
            <h2>Bug Bounty</h2>
            <p>We do not currently operate a formal paid bug bounty program. We recognize responsible reporters in our security acknowledgements and will work to offer compensation for critical vulnerabilities on a case-by-case basis.</p>
          </div>

          <p>Thank you for helping keep ɳTask secure.</p>
        </div>
      </div>
    </div>
  )
}
