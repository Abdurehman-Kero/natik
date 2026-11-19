import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, request } from '@playwright/test';

/** Pages show the Natik loader for a moment while they are prepared; wait until it has gone. */
export async function waitForPageReady(page: Page): Promise<void> {
  await page
    .getByRole('status')
    .filter({ hasText: 'Loading…' })
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);
  // The page title is streamed in with the page, a moment after the content.
  await page
    .waitForFunction(() => document.title.trim().length > 0, null, { timeout: 10_000 })
    .catch(() => undefined);
}

/**
 * Waits until React has taken over this element. Anything typed into a form before that moment is
 * replaced by the form's starting values, so forms are filled only after this.
 */
export async function waitForHydration(element: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        element.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactFiber'))),
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** WCAG 2.1 AA scan; fails on any serious or critical violation (NFR-USE-002). */
export async function expectNoSeriousA11yIssues(page: Page): Promise<void> {
  await waitForPageReady(page);
  const scan = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  let results = await scan();
  // A page that refreshes itself just after opening (for example to mark messages as seen) swaps its
  // <title> for a moment; scan again once it is back rather than report a title that does exist.
  if (results.violations.some((v) => v.id === 'document-title')) {
    await waitForPageReady(page);
    results = await scan();
  }
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')})`);
  expect(serious, serious.join('\n')).toEqual([]);
}

/** No sideways scrolling: the page must fit the viewport (FR-UI-002, 320 px phones). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  await waitForPageReady(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
}

/** Accounts created by `pnpm db:seed` (local development only). */
export const SEED = {
  owner: { phone: '911000000', password: 'ChangeMe2026' },
  teacher: { phone: '911000001', password: 'Teacher2026' },
  student: { phone: '911000002', password: 'Student2026' },
} as const;

/** A fresh Ethiopian mobile number for a brand-new account. */
export function newPhone(): string {
  return `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

/** The email an e2e account uses, worked out from its phone number so both can be found from one. */
export function emailFor(phone: string): string {
  return `u${phone.replace(/\D/g, '')}@example.com`;
}

/** A new phone number together with the email to register it with. */
export function newContact(): { phone: string; email: string } {
  const phone = newPhone();
  return { phone, email: emailFor(phone) };
}

/** Makes a student account through the API (not signed in anywhere) and returns how to sign in. */
export async function createStudent(baseURL: string) {
  const phone = newPhone();
  const account = { phone, email: emailFor(phone), password: 'Passw0rd123' };
  const api = await request.newContext({ baseURL });
  const res = await api.post('/api/v1/auth/register', {
    data: { fullName: 'E2E Visitor', ...account, acceptTerms: true, confirmAge: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  await api.dispose();
  return account;
}

/** Signs in through the API (fast); the browser then keeps the session cookie. */
export async function signInAs(
  page: Page,
  account: { phone: string; password: string },
): Promise<void> {
  const res = await page.request.post('/api/v1/auth/sign-in', {
    data: { phone: account.phone, password: account.password },
  });
  expect(res.ok(), `sign-in as ${account.phone} failed: ${res.status()}`).toBe(true);
}

/** The newest SMS sent to a number, read from the development inbox. */
export async function latestSms(page: Page, nationalPhone: string): Promise<string> {
  const url = `/api/v1/dev/sms?to=${encodeURIComponent('+251' + nationalPhone)}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await page.request.get(url);
      const { items } = (await res.json()) as { items: { to: string; body: string }[] };
      const found = items.find((item) => item.to === `+251${nationalPhone}`);
      if (found) return found.body;
    } catch {
      // a dropped connection under heavy test load: try again
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`No SMS arrived for +251${nationalPhone}`);
}

export async function latestCode(page: Page, nationalPhone: string): Promise<string> {
  const body = await latestSms(page, nationalPhone);
  const code = /(\d{6})/.exec(body)?.[1];
  if (!code) throw new Error(`No code in SMS: ${body}`);
  return code;
}

/** Types a 6-digit code into the SMS code boxes. */
export async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Digit 1 of 6' }).focus();
  await page.keyboard.type(code);
}

/**
 * The signed-in student asks to join a course, and an admin accepts them (every course needs an
 * admin's approval; a paid course waits for its payment instead and is left as it is).
 */
export async function joinCourse(page: Page, courseIdOrSlug: string): Promise<void> {
  // A slug (like "everyday-english") is looked up; an id is used as it is.
  const courseId = courseIdOrSlug.includes('-')
    ? (
        (await (await page.request.get(`/api/v1/public/courses/${courseIdOrSlug}`)).json()) as {
          id: string;
        }
      ).id
    : courseIdOrSlug;
  const asked = (await (await page.request.post(`/api/v1/courses/${courseId}/enrol`)).json()) as {
    id: string;
    status: string;
  };
  if (asked.status !== 'AWAITING_APPROVAL') return;
  const admin = await request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
  });
  try {
    expect((await admin.post('/api/v1/auth/sign-in', { data: SEED.owner })).ok()).toBe(true);
    const accepted = await admin.post(`/api/v1/admin/enrolments/${asked.id}/approve`);
    expect(accepted.ok(), await accepted.text()).toBe(true);
  } finally {
    await admin.dispose();
  }
}
