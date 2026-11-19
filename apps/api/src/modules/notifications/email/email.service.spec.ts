import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import { accountCreatedEmail, passwordLinkEmail, resetCodeEmail } from './email-templates';
import { EmailService } from './email.service';

const configFor = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as unknown as AppConfigService;

/** A tiny SMTP server that accepts one message and keeps what it received. */
function fakeSmtp(): Promise<{ server: Server; port: number; received: string[] }> {
  const received: string[] = [];
  const server = createServer((socket) => {
    let data = false;
    let buffer = '';
    socket.write('220 fake ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (data) {
        if (buffer.includes('\r\n.\r\n')) {
          received.push(buffer);
          buffer = '';
          data = false;
          socket.write('250 queued\r\n');
        }
        return;
      }
      for (const line of buffer.split('\r\n').filter(Boolean)) {
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO'))
          socket.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (command.startsWith('AUTH PLAIN')) socket.write('235 ok\r\n');
        else if (command.startsWith('AUTH LOGIN')) socket.write('334 VXNlcm5hbWU6\r\n');
        else if (command.startsWith('MAIL FROM') || command.startsWith('RCPT TO'))
          socket.write('250 ok\r\n');
        else if (command === 'DATA') {
          data = true;
          socket.write('354 go\r\n');
        } else if (command === 'QUIT') socket.end('221 bye\r\n');
        else if (!command.includes(':') && command.length > 10) socket.write('235 ok\r\n');
      }
      if (!data) buffer = '';
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : 0,
        received,
      });
    }),
  );
}

describe('email service', () => {
  const servers: Server[] = [];
  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
  });

  it('keeps messages in a mailbox and delivers nothing in console mode', async () => {
    const email = new EmailService(configFor({ EMAIL_PROVIDER: 'console' }));
    const result = await email.send(
      'a@example.com',
      passwordLinkEmail({ name: 'Abdi', email: 'a@example.com', link: 'https://x.test/set?t=1' }),
    );
    expect(result.delivered).toBe(false);
    expect(email.delivers).toBe(false);
    expect(email.recentMessages()[0]).toMatchObject({ to: 'a@example.com' });
  });

  it('sends a real message over SMTP, with the sign-in email and the link in it', async () => {
    const smtp = await fakeSmtp();
    servers.push(smtp.server);
    const email = new EmailService(
      configFor({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: smtp.port,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pass',
        EMAIL_FROM: 'Natik <owner@example.com>',
      }),
    );
    const content = accountCreatedEmail({
      name: 'Sara Mohammed',
      email: 'sara@example.com',
      role: 'TEACHER',
      link: 'https://natik.test/set-password?token=abc123',
      signInUrl: 'https://natik.test/sign-in',
    });
    const result = await email.send('sara@example.com', content);
    expect(result.delivered).toBe(true);
    // Mail on the wire is quoted-printable: long lines are wrapped and "=" is written "=3D".
    const raw = (smtp.received[0] ?? '')
      .replaceAll('=' + String.fromCharCode(13, 10), '')
      .replaceAll('=3D', '=');
    expect(raw).toContain('Subject: Your Natik account is ready');
    expect(raw).toContain('To: sara@example.com');
    expect(raw).toContain('From: Natik <owner@example.com>');
    expect(raw).toContain('https://natik.test/set-password?token=abc123');
  });

  it('never throws when the mail server cannot be reached: the answer is simply "not delivered"', async () => {
    const email = new EmailService(
      configFor({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: 1,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pass',
        EMAIL_FROM: 'Natik <owner@example.com>',
      }),
    );
    await expect(
      email.send('x@example.com', resetCodeEmail({ name: 'X', code: '123456' })),
    ).resolves.toEqual({ delivered: false });
  });
});

describe('email templates', () => {
  it('say who the person is on Natik and what to do first, per kind of account', () => {
    const link = 'https://natik.test/set-password?token=t';
    const base = {
      name: 'Abdi',
      email: 'abdi@example.com',
      link,
      signInUrl: 'https://natik.test/sign-in',
    };
    expect(accountCreatedEmail({ ...base, role: 'STUDENT' }).text).toContain('ask to join');
    expect(accountCreatedEmail({ ...base, role: 'TEACHER' }).text).toContain('My courses');
    expect(accountCreatedEmail({ ...base, role: 'ADMIN' }).text).toContain('dashboard');
    expect(accountCreatedEmail({ ...base, role: 'STUDENT' }).text).toContain('abdi@example.com');
  });

  it('never put the password in the message, only a link, and escape what people typed', () => {
    const mail = accountCreatedEmail({
      name: '<b>Bad</b> & Co',
      email: 'a@example.com',
      role: 'STUDENT',
      link: 'https://natik.test/set-password?token=t&x="1"',
      signInUrl: 'https://natik.test/sign-in',
    });
    expect(mail.html).not.toContain('<b>Bad</b>');
    expect(mail.html).toContain('&lt;b&gt;Bad&lt;/b&gt; &amp; Co');
    expect(mail.html).toContain('token=t&amp;x=&quot;1&quot;');
    expect(mail.text.toLowerCase()).not.toContain('your password is');
  });
});
