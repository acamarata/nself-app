/**
 * Purpose: Send transactional email from the backend functions service over SMTP.
 *
 * Why this module exists:
 *   Invite emails used to POST to a hasura-auth send-email route. That route
 *   does not exist: hasura-auth 0.36.0 answers it with
 *   404 {"error":"route-not-found"}, and the caller swallowed the failure into
 *   `{ sent: false }`. So email-based invites reported success and emailed
 *   nobody, in every environment, no matter how SMTP was configured
 *   (2026-08-24 completeness review, F6). hasura-auth owns ITS OWN emails
 *   (verification, password reset) and exposes no relay for ours, so this
 *   service sends its own mail with its own transport.
 *
 * Inputs:  SMTP configuration from env (AUTH_SMTP_* preferred, SMTP_* fallback),
 *          plus a recipient / subject / rendered HTML.
 * Outputs: { sent: true } or { sent: false, gate } naming what is missing or
 *          what the server said. Never a bare boolean with the reason discarded.
 *
 * Constraints:
 *   - Missing configuration is a GATE, not an error: a self-hoster with no SMTP
 *     must still be able to create invites (the in-app invite row works without
 *     email). The gate string is returned to the client so the UI can say
 *     "invite created, email not sent" instead of implying delivery.
 *   - A transport failure is NOT a gate. It returns sent:false with the server's
 *     message, and the caller surfaces it. Silence is what caused F6.
 *   - `transport` is injectable so tests assert on send attempts and on failure
 *     handling without an SMTP server.
 *   - AUTH_SMTP_* is the same configuration hasura-auth uses, so one set of
 *     credentials serves both. AUTH_SMTP_HOST must be a real hostname:
 *     hasura-auth accepts the literal value "postmark" as a mode switch, and
 *     that is not resolvable by anything else.
 *
 * SPORT: F08 backend functions — outbound email.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface SendResult {
  sent: boolean;
  /** Present when nothing was sent; names the missing config or the failure. */
  gate?: string;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Minimal shape this module needs from a transport, so tests can stub it. */
export interface MailTransport {
  sendMail(mail: {
    from: string; to: string; subject: string; html: string; text?: string;
  }): Promise<unknown>;
}

const env = (k: string): string => process.env[k]?.trim() ?? '';

/**
 * Resolve SMTP settings from the environment.
 * Returns null when the stack has no mail configuration at all.
 */
export function resolveConfig(): MailerConfig | null {
  const host = env('AUTH_SMTP_HOST') || env('SMTP_HOST');
  if (!host) return null;
  // hasura-auth treats the literal "postmark" as "use the Postmark API with
  // server-side templates". Nothing else can connect to a host by that name.
  if (host.toLowerCase() === 'postmark') return null;

  const from =
    env('SMTP_FROM_ADDRESS') || env('AUTH_SMTP_SENDER') || env('SMTP_SENDER');
  if (!from) return null;

  const portRaw = env('AUTH_SMTP_PORT') || env('SMTP_PORT') || '587';
  const secureRaw = (env('AUTH_SMTP_SECURE') || env('SMTP_SECURE') || 'false').toLowerCase();
  const user = env('AUTH_SMTP_USER') || env('SMTP_USER');
  const pass = env('AUTH_SMTP_PASS') || env('SMTP_PASS');

  return {
    host,
    port: Number.parseInt(portRaw, 10) || 587,
    secure: secureRaw === 'true' || secureRaw === '1',
    ...(user ? { user } : {}),
    ...(pass ? { pass } : {}),
    from,
  };
}

const MISSING =
  'NTASK-EMAIL-UNCONFIGURED: set AUTH_SMTP_HOST (a real hostname) and ' +
  'SMTP_FROM_ADDRESS or AUTH_SMTP_SENDER on the functions service to send email';

let cached: Transporter | null = null;

function defaultTransport(cfg: MailerConfig): MailTransport {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      ...(cfg.user && cfg.pass ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
    });
  }
  return cached as unknown as MailTransport;
}

/**
 * Send one message. Resolves with sent:false and a reason rather than throwing,
 * because a failed invite email must not fail the invite itself.
 */
export async function sendMail(
  mail: Mail,
  opts: { config?: MailerConfig | null; transport?: MailTransport } = {},
): Promise<SendResult> {
  const cfg = opts.config !== undefined ? opts.config : resolveConfig();
  if (!cfg) return { sent: false, gate: MISSING };

  const transport = opts.transport ?? defaultTransport(cfg);
  try {
    await transport.sendMail({
      from: cfg.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.text ? { text: mail.text } : {}),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, gate: `SMTP send failed: ${(err as Error).message}` };
  }
}

/**
 * Fill a Go-style `{{ .Name }}` template. The email templates in
 * backend/email-templates/ use that syntax because hasura-auth renders them;
 * this keeps one set of files for both senders instead of forking them.
 * Unknown placeholders are left untouched so a missing variable is visible in
 * the delivered mail rather than silently blank.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : whole,
  );
}
