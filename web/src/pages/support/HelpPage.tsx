/**
 * HelpPage.tsx — /help — consolidated in-app help center
 *
 * Purpose:    Ports the 9 help/getting-started markdown articles from the
 *             retired web/ntask-marketing app (src/content/help/*.md) into
 *             one in-app page, per ADR-P6-04. None of these topics
 *             (task creation, lists, offline sync, troubleshooting,
 *             per-platform getting-started, docker quickstart) are covered
 *             by the marketing-level org docs at
 *             nself.org/docs/features/ntask or
 *             nself.org/docs/guides/ntask-self-hosting — verified 2026-08-31,
 *             zero keyword overlap — so content is ported here rather than
 *             redirected, to avoid silently dropping it.
 * Inputs:     none
 * Outputs:    static help content, anchored by section id for deep-linking
 *             from the old ntask-marketing paths (see App.tsx redirects
 *             and vercel.json for the old-path -> #anchor mapping).
 * Constraints: No markdown renderer dependency added — content is
 *             hand-transcribed to JSX to avoid a new build-time dependency.
 * SPORT:      P6-E7-W4-S1-T5
 */

export function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-16">
        <header>
          <h1 className="text-3xl font-bold">Help Center</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Guides for using ɳTask, self-hosting it, and troubleshooting sync.
          </p>
        </header>

        <section id="create-task">
          <h2 className="text-2xl font-semibold mb-2">Creating and Managing Tasks</h2>
          <h3 className="font-medium mt-4">Creating a Task</h3>
          <p><strong>Mobile:</strong> Tap + in the bottom toolbar. <strong>Desktop / Web:</strong> Click + New Task in the sidebar, or press N.</p>
          <h3 className="font-medium mt-4">Task Fields</h3>
          <ul className="list-disc pl-6">
            <li>Title — required, up to 500 characters</li>
            <li>Due date — optional, triggers a reminder notification</li>
            <li>Priority — Urgent, High, Normal, Low (default Normal)</li>
            <li>Tags — color-coded labels, create as many as you like</li>
            <li>List — assign to any list or project</li>
            <li>Notes — rich text, supports markdown</li>
          </ul>
          <h3 className="font-medium mt-4">Subtasks</h3>
          <p>Open any task and tap Add subtask to nest tasks below it. Subtasks can have their own due dates and priorities.</p>
          <h3 className="font-medium mt-4">Completing a Task</h3>
          <p>Tap or click the circle to the left of the task title. Completed tasks move to the Done section.</p>
        </section>

        <section id="lists">
          <h2 className="text-2xl font-semibold mb-2">Managing Lists</h2>
          <p>ɳTask organizes tasks in Lists. Every task belongs to a list.</p>
          <h3 className="font-medium mt-4">Creating a List</h3>
          <p><strong>Mobile:</strong> Tap Lists in the bottom tab, then +. <strong>Desktop / Web:</strong> Click New List in the left sidebar.</p>
          <h3 className="font-medium mt-4">Sharing a List</h3>
          <p>Open a list, tap the ... menu, and choose Share. Enter the email address of a collaborator — they receive an invitation to join the list. Shared members can view, create, edit, and complete tasks; owners can manage members and delete the list.</p>
          <h3 className="font-medium mt-4">Smart Lists</h3>
          <ul className="list-disc pl-6">
            <li>Today — tasks due today</li>
            <li>Upcoming — tasks due in the next 7 days</li>
            <li>Inbox — tasks with no list assigned</li>
            <li>Done — recently completed tasks</li>
          </ul>
        </section>

        <section id="offline-mode">
          <h2 className="text-2xl font-semibold mb-2">Offline Mode and Sync</h2>
          <p>ɳTask stores your data locally on every device. You can create, edit, and complete tasks with no internet connection — changes sync automatically once connectivity returns.</p>
          <h3 className="font-medium mt-4">How Sync Works</h3>
          <ol className="list-decimal pl-6">
            <li>Every action is written to the local database immediately.</li>
            <li>Changes are queued in the offline sync queue.</li>
            <li>When a connection is available, the queue flushes to the server.</li>
            <li>The server broadcasts the change to all other connected devices via WebSocket.</li>
          </ol>
          <h3 className="font-medium mt-4">Conflict Resolution</h3>
          <ul className="list-disc pl-6">
            <li>Title changes: last-write wins (by timestamp)</li>
            <li>Completion status: completed wins over incomplete</li>
            <li>Subtask additions: both subtasks are preserved</li>
          </ul>
        </section>

        <section id="troubleshooting-sync">
          <h2 className="text-2xl font-semibold mb-2">Troubleshooting Sync Issues</h2>
          <h3 className="font-medium mt-4">Tasks Not Appearing on Another Device</h3>
          <ol className="list-decimal pl-6">
            <li>Check your connection — both devices must have internet access.</li>
            <li>Check you're signed in to the same account — Settings → Account on each device.</li>
            <li>Force a sync — pull down to refresh on mobile, or Ctrl+Shift+R on web/desktop.</li>
            <li>Check the sync indicator — if it shows an error, tap it for details.</li>
          </ol>
          <h3 className="font-medium mt-4">"Server Unreachable"</h3>
          <p>Your self-hosted server may be down (run <code>nself status</code>), its SSL certificate may have expired (run <code>nself ssl renew</code>), or a firewall is blocking port 443.</p>
          <h3 className="font-medium mt-4">"Conflict"</h3>
          <p>Open the task and choose Keep This Version or Keep Server Version.</p>
          <p>Still stuck? Open a <a className="underline" href="https://github.com/nself-org/ntask/issues">GitHub issue</a> or email hello@nself.org.</p>
        </section>

        <section id="getting-started-web">
          <h2 className="text-2xl font-semibold mb-2">Getting Started: Web</h2>
          <p>Visit task.nself.org and create a free account — no credit card required. Click + New Task in the sidebar or press N anywhere in the app.</p>
          <h3 className="font-medium mt-4">Keyboard Shortcuts</h3>
          <ul className="list-disc pl-6">
            <li>N — new task</li>
            <li>Enter — save task</li>
            <li>Escape — cancel</li>
            <li>/ — search</li>
            <li>? — show all shortcuts</li>
          </ul>
        </section>

        <section id="getting-started-ios">
          <h2 className="text-2xl font-semibold mb-2">Getting Started: iOS</h2>
          <p>ɳTask for iOS is on the App Store. On first launch, choose your backend: Cloud (task.nself.org, no server needed) or Self-hosted (enter your server URL — requires a running nSelf instance with the storage, auth, cron, and notify plugins).</p>
        </section>

        <section id="getting-started-self-host">
          <h2 className="text-2xl font-semibold mb-2">Self-Hosting Quickstart</h2>
          <p>A 1-CPU / 512MB RAM Linux VPS with Docker is sufficient for personal or small-team use.</p>
          <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm overflow-x-auto">{`curl -fsSL https://install.nself.org | sh
nself plugin install storage auth cron notify
nself build
nself start`}</pre>
          <p>nSelf generates docker-compose.yml, starts all services, and provisions TLS automatically via Let's Encrypt. Open ɳTask on any device, choose Self-hosted at login, and enter your server URL. To update: <code>nself stop && nself update && nself start</code>.</p>
          <h3 className="font-medium mt-4">Docker Prerequisites</h3>
          <ul className="list-disc pl-6">
            <li>Linux server, x86-64 or ARM64 (Ubuntu 22.04 / Debian 12 tested)</li>
            <li>Docker 20.10+</li>
            <li>Ports 80 and 443 open</li>
            <li>A domain name pointing to your server's IP</li>
          </ul>
          <h3 className="font-medium mt-4">Free Plugins Required</h3>
          <ul className="list-disc pl-6">
            <li><code>storage</code> — file uploads and attachment storage</li>
            <li><code>auth</code> — user accounts, JWT, OAuth</li>
            <li><code>cron</code> — recurring task reminders</li>
            <li><code>notify</code> — push notifications</li>
          </ul>
          <p>Verify: <code>nself status</code> and <code>curl https://your-domain.com/healthz</code>.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Full production deployment guide: <a className="underline" href="https://nself.org/docs/guides/ntask-self-hosting">nself.org/docs/guides/ntask-self-hosting</a>.</p>
        </section>

        <section id="faq">
          <h2 className="text-2xl font-semibold mb-2">Frequently Asked Questions</h2>
          <h3 className="font-medium mt-4">Is ɳTask free?</h3>
          <p>Yes — MIT open source and free forever. The cloud version at task.nself.org is free for personal use, with no paid tier for ɳTask itself.</p>
          <h3 className="font-medium mt-4">What platforms does ɳTask support?</h3>
          <p>iOS 16+, Android 10+, macOS 12+, Windows 10+, Linux, Apple TV (tvOS 16+), and Android TV / Fire TV.</p>
          <h3 className="font-medium mt-4">Do I need a server?</h3>
          <p>No — use the hosted cloud for free, or self-host in about five minutes with nSelf if you'd rather own your data.</p>
          <h3 className="font-medium mt-4">Is my data private?</h3>
          <p>Self-hosted, your data never leaves your server. On the cloud version, data is encrypted at rest and in transit; we do not sell or share it.</p>
          <h3 className="font-medium mt-4">How is ɳTask different from Todoist or Things?</h3>
          <p>Free, open source, and self-hostable. No per-user subscription, no proprietary sync lock-in, no feature hidden behind a paywall.</p>
        </section>
      </div>
    </div>
  )
}
