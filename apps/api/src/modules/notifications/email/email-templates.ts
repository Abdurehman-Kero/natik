/** The emails the platform sends. Plain words, one clear action, English for now. */

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

const ROLE_NAME: Record<Role, string> = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

/** Told to everyone: the account is theirs to manage. */
const MANAGE_HINT =
  'The account is yours to manage: open Profile any time to change your name, photo, email or password.';

/** What to do first, per kind of account. */
const ROLE_HINT: Record<Role, string> = {
  STUDENT:
    'After you sign in, open Courses, choose a course and ask to join. The Natik team accepts you, and then the course opens.',
  TEACHER:
    'After you sign in, open My courses to add weeks and sessions, mark your students’ work and answer their questions.',
  ADMIN:
    'After you sign in you will find the dashboard: enrolments, payments, courses, users and the website editor.',
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** One branded page around the message: navy header, gold button, nothing loaded from elsewhere. */
function page(options: {
  title: string;
  paragraphs: string[];
  facts?: { label: string; value: string }[];
  button?: { label: string; url: string };
  footnote: string;
}): string {
  const paragraphs = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join('');
  const facts = (options.facts ?? [])
    .map(
      (f) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#5b6770;font-size:14px">${escapeHtml(f.label)}</td>` +
        `<td style="padding:6px 0;font-size:16px;font-weight:600">${escapeHtml(f.value)}</td></tr>`,
    )
    .join('');
  const button = options.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(options.button.url)}" ` +
      `style="background:#123b5a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px;display:inline-block">` +
      `${escapeHtml(options.button.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;color:#5b6770;word-break:break-all">If the button does not work, copy this address into your browser:<br>${escapeHtml(options.button.url)}</p>`
    : '';
  return (
    `<!doctype html><html><body style="margin:0;background:#f7f6f2;font-family:Arial,Helvetica,sans-serif;color:#202a32">` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 16px">` +
    `<div style="background:#123b5a;color:#ffffff;padding:20px 24px;border-radius:14px 14px 0 0;border-bottom:4px solid #b69a4a">` +
    `<div style="font-size:13px;letter-spacing:2px;color:#b69a4a;font-weight:700">NATIK LANGUAGE CENTRE</div>` +
    `<div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(options.title)}</div></div>` +
    `<div style="background:#ffffff;padding:24px;border-radius:0 0 14px 14px">${paragraphs}` +
    (facts ? `<table style="margin:0 0 8px;border-collapse:collapse">${facts}</table>` : '') +
    `${button}<p style="margin:0;font-size:13px;color:#5b6770">${escapeHtml(options.footnote)}</p></div></div></body></html>`
  );
}

/** A person was added by an admin: who they are on Natik, and the link where they choose their password. */
export function accountCreatedEmail(p: {
  name: string;
  email: string;
  role: Role;
  link: string;
  signInUrl: string;
}): EmailContent {
  const intro = `The Natik team created a ${ROLE_NAME[p.role]} account for you.`;
  const text = [
    `Hello ${p.name},`,
    '',
    intro,
    '',
    `Your sign-in email: ${p.email}`,
    '',
    'Choose your password here (the link works once and expires in 3 days):',
    p.link,
    '',
    `Then sign in at ${p.signInUrl} with your email and the password you chose.`,
    '',
    ROLE_HINT[p.role],
    '',
    MANAGE_HINT,
    '',
    'If you were not expecting this message, you can ignore it. Nothing happens until you choose a password.',
    '',
    'Natik Language Centre',
  ].join('\n');
  return {
    subject: 'Your Natik account is ready',
    text,
    html: page({
      title: 'Your account is ready',
      paragraphs: [`Hello ${p.name},`, intro, ROLE_HINT[p.role], MANAGE_HINT],
      facts: [
        { label: 'Account', value: ROLE_NAME[p.role] },
        { label: 'Sign-in email', value: p.email },
      ],
      button: { label: 'Choose your password', url: p.link },
      footnote:
        'The link works once and expires in 3 days. If you were not expecting this message, ignore it: nothing happens until you choose a password.',
    }),
  };
}

/** An admin sent a fresh link (a forgotten password, or the first link expired). */
export function passwordLinkEmail(p: { name: string; email: string; link: string }): EmailContent {
  const text = [
    `Hello ${p.name},`,
    '',
    'The Natik team sent you a link to set a new password.',
    '',
    `Your sign-in email: ${p.email}`,
    '',
    'Choose your password here (the link works once and expires in 3 days):',
    p.link,
    '',
    'If you were not expecting this message, you can ignore it.',
    '',
    'Natik Language Centre',
  ].join('\n');
  return {
    subject: 'Set a new password for Natik',
    text,
    html: page({
      title: 'Set a new password',
      paragraphs: [`Hello ${p.name},`, 'The Natik team sent you a link to set a new password.'],
      facts: [{ label: 'Sign-in email', value: p.email }],
      button: { label: 'Choose your password', url: p.link },
      footnote:
        'The link works once and expires in 3 days. If you were not expecting this message, ignore it.',
    }),
  };
}

/** The six-digit code of "Forgot password". */
export function resetCodeEmail(p: { name: string; code: string }): EmailContent {
  const text = [
    `Hello ${p.name},`,
    '',
    `Your Natik password reset code is ${p.code}.`,
    'It expires in 10 minutes.',
    '',
    'If you did not ask for it, you can ignore this message: your password has not changed.',
    '',
    'Natik Language Centre',
  ].join('\n');
  return {
    subject: `${p.code} is your Natik reset code`,
    text,
    html: page({
      title: 'Your reset code',
      paragraphs: [
        `Hello ${p.name},`,
        'Use this code to reset your password. It expires in 10 minutes.',
      ],
      facts: [{ label: 'Code', value: p.code }],
      footnote: 'If you did not ask for it, ignore this message: your password has not changed.',
    }),
  };
}
