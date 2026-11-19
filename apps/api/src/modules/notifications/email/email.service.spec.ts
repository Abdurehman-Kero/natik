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
      passwordLinkEmail({
        name: 'Abdi',
        email: 'a@example.com',
        link: 'https://x.test/set?t=1',
        role: 'STUDENT',
      }),
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
    expect(raw).toContain('Subject: Welcome to Natik: your teacher account is ready');
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
    // Each one is told, in words, what the Natik team gave them.
    const student = accountCreatedEmail({ ...base, role: 'STUDENT' });
    expect(student.text).toContain('created a student account for you at Natik Language Centre');
    expect(student.text).toContain('Your role: Student');
    expect(student.text).toContain('As a student you can:');
    const teacher = accountCreatedEmail({ ...base, role: 'TEACHER' });
    expect(teacher.text).toContain('given you access as a teacher at Natik Language Centre');
    expect(teacher.text).toContain('Your role: Teacher');
    expect(teacher.text).toContain('Mark your students’ quizzes and written work');
    expect(teacher.text).not.toContain('Accept students into courses');
    expect(teacher.subject).toBe('Welcome to Natik: your teacher account is ready');
    const admin = accountCreatedEmail({ ...base, role: 'ADMIN' });
    expect(admin.text).toContain('given you access as an administrator of Natik Language Centre');
    expect(admin.text).toContain('As an administrator you can:');
    expect(admin.html).toContain('<li');
    expect(admin.html).toContain('Administrator');
    expect(accountCreatedEmail({ ...base, role: 'STUDENT' }).text).toContain('abdi@example.com');
    // Everyone is told the account is theirs to manage.
    expect(accountCreatedEmail({ ...base, role: 'TEACHER' }).text).toContain(
      'open Profile any time',
    );
    expect(accountCreatedEmail({ ...base, role: 'TEACHER' }).html).toContain(
      'change your name, photo, email or password',
    );
  });

  it('tell people their password is private: only they set it and nobody can see it', () => {
    const base = {
      name: 'Abdi',
      email: 'abdi@example.com',
      link: 'https://natik.test/set-password?token=t',
    };
    for (const role of ['STUDENT', 'TEACHER', 'ADMIN'] as const) {
      const created = accountCreatedEmail({
        ...base,
        role,
        signInUrl: 'https://natik.test/sign-in',
      });
      const resent = passwordLinkEmail({ ...base, role });
      for (const mail of [created, resent]) {
        expect(mail.text).toContain('Only you choose it');
        expect(mail.text).toContain('administrators included');
        expect(mail.text).toContain('never sent by email');
        expect(mail.html).toContain('Only you choose it');
      }
      expect(resent.text).toContain(`${role.toLowerCase()} account`);
    }
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
