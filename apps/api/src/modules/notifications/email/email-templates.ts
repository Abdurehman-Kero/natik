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

const ROLE_TITLE: Record<Role, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
};

/** Told to everyone: the account is theirs to manage. */
const MANAGE_HINT =
  'The account is yours to manage: open Profile any time to change your name, photo, email or password.';

/** Told with every password link: nobody else sees or sets the password. */
const PASSWORD_PRIVACY =
  'Your password stays private. Only you choose it, nobody at Natik (administrators included) can see it, and it is never sent by email. The link works once and only for you.';

/**
 * What each kind of person is told: what the Natik team gave them, what that lets them do, and the
 * first thing to open. Plain words, because many readers are new to online learning.
 */
const ROLE_WELCOME: Record<Role, { intro: string; canDo: string[]; first: string }> = {
  STUDENT: {
    intro:
      'The Natik team has created a student account for you at Natik Language Centre, so you can learn with us.',
    canDo: [
      'Look through the courses and ask to join the ones you like. The Natik team accepts you, and then the course opens.',
      'Follow each week’s lessons, take the quizzes and see how far you have come.',
      'Chat with your teacher and your classmates in your course group.',
      'Receive your certificate when you finish a course.',
    ],
    first:
      'Open Courses, choose a course and ask to join. The Natik team accepts you, and then the course opens.',
  },
  TEACHER: {
    intro:
      'The Natik team has given you access as a teacher at Natik Language Centre. You can now teach on Natik.',
    canDo: [
      'Build your courses: add weeks and sessions with lessons, files and quizzes.',
      'See the students in your courses and follow their progress.',
      'Mark your students’ quizzes and written work, and give them feedback.',
      'Answer questions and talk with your students in each course group.',
    ],
    first:
      'Open My courses to add weeks and sessions, mark your students’ work and answer their questions.',
  },
  ADMIN: {
    intro:
      'The Natik team has given you access as an administrator of Natik Language Centre. You can now help run the centre.',
    canDo: [
      'Accept students into courses and check their payments.',
      'Manage the courses, the teachers and the students.',
      'Edit the website and send announcements.',
      'See the reports and the activity log.',
    ],
    first:
      'Open the dashboard: enrolments, payments, courses, users and the website editor. Administrators can see people’s personal details, so keep your password private.',
  },
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
  /** A short bulleted list under a heading (what the person can do). */
  list?: { title: string; items: string[] };
  button?: { label: string; url: string };
  /** More paragraphs, after the button. */
  after?: string[];
  footnote: string;
}): string {
  const paragraphs = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join('');
  const after = (options.after ?? [])
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join('');
  const list = options.list
    ? `<p style="margin:8px 0 6px;font-size:16px;font-weight:700">${escapeHtml(options.list.title)}</p>` +
      `<ul style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.5">` +
      options.list.items
        .map((item) => `<li style="margin:0 0 6px">${escapeHtml(item)}</li>`)
        .join('') +
      '</ul>'
    : '';
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
    (facts ? `<table style="margin:0 0 16px;border-collapse:collapse">${facts}</table>` : '') +
    `${list}${button}${after}<p style="margin:0;font-size:13px;color:#5b6770">${escapeHtml(options.footnote)}</p></div></div></body></html>`
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
  const welcome = ROLE_WELCOME[p.role];
  const canDoTitle = `As ${p.role === 'ADMIN' ? 'an administrator' : `a ${ROLE_NAME[p.role]}`} you can:`;
  const afterSignIn = `Then sign in at ${p.signInUrl} with your email and the password you chose.`;
  const text = [
    `Hello ${p.name},`,
    '',
    welcome.intro,
    '',
    `Your role: ${ROLE_TITLE[p.role]}`,
    `Your sign-in email: ${p.email}`,
    '',
    canDoTitle,
    ...welcome.canDo.map((item) => `- ${item}`),
    '',
    'To get started, choose your password here (the link works once and expires in 3 days):',
    p.link,
    '',
    PASSWORD_PRIVACY,
    '',
    afterSignIn,
    welcome.first,
    '',
    MANAGE_HINT,
    '',
    'If you were not expecting this message, you can ignore it. Nothing happens until you choose a password.',
    '',
    'Natik Language Centre',
  ].join('\n');
  return {
    subject: `Welcome to Natik: your ${ROLE_NAME[p.role]} account is ready`,
    text,
    html: page({
      title: `Welcome to Natik, ${ROLE_NAME[p.role]}`,
      paragraphs: [`Hello ${p.name},`, welcome.intro],
      facts: [
        { label: 'Your role', value: ROLE_TITLE[p.role] },
        { label: 'Sign-in email', value: p.email },
      ],
      list: { title: canDoTitle, items: welcome.canDo },
      button: { label: 'Choose your password', url: p.link },
      after: [PASSWORD_PRIVACY, afterSignIn, welcome.first, MANAGE_HINT],
      footnote:
        'The link works once and expires in 3 days. If you were not expecting this message, ignore it: nothing happens until you choose a password.',
    }),
  };
}

/** An admin sent a fresh link (a forgotten password, or the first link expired). */
export function passwordLinkEmail(p: {
  name: string;
  email: string;
  link: string;
  role: Role;
}): EmailContent {
  const intro = `The Natik team sent you a link to set a new password for your ${ROLE_NAME[p.role]} account at Natik Language Centre.`;
  const text = [
    `Hello ${p.name},`,
    '',
    intro,
    '',
    `Your role: ${ROLE_TITLE[p.role]}`,
    `Your sign-in email: ${p.email}`,
    '',
    'Choose your password here (the link works once and expires in 3 days):',
    p.link,
    '',
    PASSWORD_PRIVACY,
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
      paragraphs: [`Hello ${p.name},`, intro],
      facts: [
        { label: 'Your role', value: ROLE_TITLE[p.role] },
        { label: 'Sign-in email', value: p.email },
      ],
      button: { label: 'Choose your password', url: p.link },
      after: [PASSWORD_PRIVACY],
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
