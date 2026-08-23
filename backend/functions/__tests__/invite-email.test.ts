/**
 * Purpose: Cover invite-email delivery, and specifically the failure that the
 *   old code could not report: the transport refusing the message.
 *
 * The previous implementation POSTed to a hasura-auth route that answers 404 and
 * returned `{ sent: res.ok }` with the body discarded, so a permanent, total
 * delivery failure looked identical to success. Every test here asserts the
 * REASON travels with the result, not just a boolean.
 * SPORT: F08 backend functions — outbound email.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sendInviteEmail } from '../collab-ops.js';
import { renderTemplate, resolveConfig, sendMail, type MailTransport } from '../lib/mailer.js';

const CONFIG = {
  host: 'mailhog', port: 1025, secure: false, from: 'no-reply@task.nself.org',
};

function recorder(behaviour: 'ok' | 'throw' = 'ok') {
  const sent: Array<Record<string, unknown>> = [];
  const transport: MailTransport = {
    async sendMail(mail) {
      sent.push(mail as unknown as Record<string, unknown>);
      if (behaviour === 'throw') {
        throw new Error('550 5.7.1 Message rejected by relay');
      }
      return { messageId: 'm1' };
    },
  };
  return { transport, sent };
}

const invite = {
  to: 'invitee@example.com',
  inviterName: 'Owner',
  listTitle: 'Groceries',
  inviteToken: 'tok-123',
  role: 'editor',
};

describe('sendInviteEmail', () => {
  test('sends the rendered invite to the invitee', async () => {
    const { transport, sent } = recorder();
    const result = await sendInviteEmail(invite, { transport, config: CONFIG });

    assert.deepEqual(result, { sent: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!['to'], 'invitee@example.com');
    assert.equal(sent[0]!['from'], 'no-reply@task.nself.org');
    assert.match(String(sent[0]!['subject']), /invited you to "Groceries"/);
  });

  test('the body carries the accept link and no unrendered placeholders', async () => {
    const { transport, sent } = recorder();
    await sendInviteEmail(invite, { transport, config: CONFIG });

    const html = String(sent[0]!['html']);
    assert.match(html, /invite\?token=tok-123/);
    assert.doesNotMatch(html, /\{\{\s*\./, 'template variables were left unrendered');
    assert.match(html, /Groceries/);
    assert.match(html, /editor/);
  });

  test('a rejecting transport is reported, never swallowed', async () => {
    // This is the regression the old implementation could not catch: it read
    // res.ok off a 404 and returned sent:false with no reason at all.
    const { transport } = recorder('throw');
    const result = await sendInviteEmail(invite, { transport, config: CONFIG });

    assert.equal(result.sent, false);
    assert.match(String(result.gate), /Message rejected by relay/);
  });

  test('no SMTP configuration is a named gate, not a silent no-op', async () => {
    const { transport, sent } = recorder();
    const result = await sendInviteEmail(invite, { transport, config: null });

    assert.equal(result.sent, false);
    assert.match(String(result.gate), /NTASK-EMAIL-UNCONFIGURED/);
    assert.equal(sent.length, 0, 'nothing should be handed to a transport');
  });
});

describe('resolveConfig', () => {
  const snapshot = { ...process.env };
  const reset = () => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SMTP_') || k.startsWith('AUTH_SMTP_')) delete process.env[k];
    }
    Object.assign(process.env, Object.fromEntries(
      Object.entries(snapshot).filter(([k]) => k.startsWith('SMTP_') || k.startsWith('AUTH_SMTP_')),
    ));
  };

  test('prefers AUTH_SMTP_* and falls back to SMTP_*', () => {
    reset();
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SMTP_') || k.startsWith('AUTH_SMTP_')) delete process.env[k];
    }
    process.env['SMTP_HOST'] = 'mailhog';
    process.env['SMTP_PORT'] = '1025';
    process.env['SMTP_FROM_ADDRESS'] = 'a@b.c';
    assert.deepEqual(resolveConfig(), {
      host: 'mailhog', port: 1025, secure: false, from: 'a@b.c',
    });

    process.env['AUTH_SMTP_HOST'] = 'smtp.postmarkapp.com';
    process.env['AUTH_SMTP_PORT'] = '587';
    assert.equal(resolveConfig()?.host, 'smtp.postmarkapp.com');
    assert.equal(resolveConfig()?.port, 587);
    reset();
  });

  test('the literal host "postmark" is treated as unconfigured', () => {
    // hasura-auth reads AUTH_SMTP_HOST=postmark as "use the Postmark API with
    // server-side templates". No socket can be opened to a host by that name,
    // and a connection error there would look like a mail outage.
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SMTP_') || k.startsWith('AUTH_SMTP_')) delete process.env[k];
    }
    process.env['AUTH_SMTP_HOST'] = 'postmark';
    process.env['SMTP_FROM_ADDRESS'] = 'a@b.c';
    assert.equal(resolveConfig(), null);
    reset();
  });
});

describe('renderTemplate', () => {
  test('fills Go-style placeholders and leaves unknown ones visible', () => {
    const out = renderTemplate('Hi {{ .Name }} / {{ .Missing }}', { Name: 'Sam' });
    assert.equal(out, 'Hi Sam / {{ .Missing }}');
  });
});

describe('sendMail', () => {
  test('returns the transport error text so the caller can surface it', async () => {
    const transport: MailTransport = {
      async sendMail() { throw new Error('ECONNREFUSED 127.0.0.1:1025'); },
    };
    const r = await sendMail({ to: 'x@y.z', subject: 's', html: '<p>h</p>' },
      { transport, config: CONFIG });
    assert.equal(r.sent, false);
    assert.match(String(r.gate), /ECONNREFUSED/);
  });
});
