import { expect, type Page, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  SEED,
  signInAs,
} from './helpers';

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function registerStudent(page: Page, name = `E2E Ops ${unique()}`) {
  const phone = newPhone();
  const res = await page.request.post('/api/v1/auth/register', {
    data: { fullName: name, phone, password: 'Passw0rd123', acceptTerms: true, confirmAge: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { name, phone };
}

test.describe('admin screens fit every phone and are accessible', () => {
  test('dashboard, reports, activity log and settings', async ({ page }) => {
    await signInAs(page, SEED.owner);
    for (const [path, heading] of [
      ['/admin', /Hello/],
      ['/admin/reports', 'Reports'],
      ['/admin/reports?type=payments', 'Reports'],
      ['/admin/activity', 'Activity log'],
      ['/admin/settings', 'Settings'],
      ['/admin/settings/sms', 'SMS delivery'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    }
  });
});

test.describe('admin dashboard and settings (desktop)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Tried on a desktop.');
  });

  test('every dashboard card leads to its queue, and the settings hub links work', async ({
    page,
  }) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin');
    const cards = page.getByRole('region', { name: 'Dashboard' });
    await expect(cards.getByText('Payments to check')).toBeVisible();
    await expect(cards.getByText('New messages')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active enrolments by course' })).toBeVisible();
    await cards
      .getByRole('link', { name: /Review now|All checked/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/payments/);
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Post announcement' }).click();
    await expect(page).toHaveURL(/\/admin\/announcements/);

    await page.goto('/admin/settings');
    for (const [name, url] of [
      ['Payment accounts', /\/admin\/settings\/payments/],
      ['Languages and levels', /\/admin\/settings\/catalogue/],
      ['Certificate signatory', /\/admin\/settings\/certificate/],
      ['SMS delivery', /\/admin\/settings\/sms/],
      ['Admins and owner', /\/admin\/users/],
      ['Reports', /\/admin\/reports/],
      ['Activity log', /\/admin\/activity/],
    ] as const) {
      await page.goto('/admin/settings');
      await page
        .getByRole('link', { name: new RegExp(name) })
        .first()
        .click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
  });

  test('reports: each report loads, filters, and exports a CSV that opens in Excel', async ({
    page,
  }) => {
    await signInAs(page, SEED.owner);
    // A student with an Arabic name, so the file proves Arabic survives.
    const { name } = await registerStudent(page, `عبد الله ${unique()}`);
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);

    for (const tab of ['Registrations', 'Enrolments', 'Payments', 'Progress & scores']) {
      await page.goto('/admin/reports');
      const link = page
        .getByRole('navigation', { name: 'Reports' })
        .getByRole('link', { name: tab, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      // Either rows or a friendly empty message, never an error.
      await expect(
        page.getByRole('table').or(page.getByText('Nothing in this report')),
      ).toBeVisible();
    }

    await page.goto('/admin/reports?type=registrations&preset=month');
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText('Registrations:')).toBeVisible();

    const exportHref = await page.getByRole('link', { name: 'Export CSV' }).getAttribute('href');
    const csv = await page.request.get(exportHref!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    const body = await csv.body();
    expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = body.toString('utf8');
    expect(text).toContain(name);
    expect(text.split('\r\n')[0]).toContain('Name');
    // No full phone numbers in any report.
    expect(text).not.toMatch(/\+251 ?9\d{8}/);
  });

  test('activity log: filter to payment decisions and open a row', async ({ page }) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin/activity?group=PAYMENTS');
    await expect(page.getByRole('combobox', { name: 'Action' })).toHaveValue('PAYMENTS');
    const rows = page.getByRole('button', { name: /Payment/ });
    if ((await rows.count()) > 0) {
      await expect(rows.first()).toContainText(/Payment/);
      await rows.first().click();
      await expect(page.getByRole('dialog')).toContainText('What happened');
      await page.keyboard.press('Escape');
    }
    await page.getByRole('combobox', { name: 'Action' }).selectOption('SIGN_IN');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/group=SIGN_IN/);
    await expect(page.getByRole('button', { name: /Sign in/ }).first()).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });

  test('an admin deletes a student’s personal data; they can no longer sign in', async ({
    page,
  }) => {
    const { name, phone } = await registerStudent(page);
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);
    await page.goto(`/admin/users?q=${encodeURIComponent(name)}`);
    await page.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Delete personal data' }).click();
    await page.getByRole('button', { name: 'Delete personal data' }).last().click();
    await expect(page.getByText('Please give a reason.')).toBeVisible();
    await page.getByLabel('Reason').fill('Test finished');
    await page.getByRole('button', { name: 'Delete personal data' }).last().click();
    await expect(page.getByText('Personal data deleted')).toBeVisible();

    await page.context().clearCookies();
    const attempt = await page.request.post('/api/v1/auth/sign-in', {
      data: { phone, password: 'Passw0rd123' },
    });
    expect(attempt.status()).toBe(401);
  });
});

test.describe('teacher home and student progress (desktop)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Tried on a desktop.');
  });

  test('the teacher home shows counts; the students page searches and exports without phone numbers', async ({
    page,
  }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/teach');
    await expect(page.getByText('To mark')).toBeVisible();
    await expect(page.getByText('Students', { exact: true }).first()).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    // The seeded Everyday English course: the student we enrol appears in the list.
    const { name, phone } = await registerStudent(page);
    await page.request.post(
      '/api/v1/courses/' + (await courseId(page, 'everyday-english')) + '/enrol',
    );
    await page.context().clearCookies();
    await signInAs(page, SEED.teacher);
    const id = await courseId(page, 'everyday-english');
    await page.goto(`/teach/courses/${id}/students?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(/Phone numbers and payments are not shown/)).toBeVisible();
    expect(await page.content()).not.toContain(phone);
    await expectNoSeriousA11yIssues(page);

    const href = await page.getByRole('link', { name: 'Export CSV' }).getAttribute('href');
    const csv = await page.request.get(href!);
    expect(csv.status()).toBe(200);
    const text = (await csv.body()).toString('utf8');
    expect(text.split('\r\n')[0]).toContain('Student,Status,Progress %');
    expect(text).toContain(name);
    expect(text).not.toContain(phone);
    expect(text).not.toMatch(/phone|payment|amount/i);
  });
});

async function courseId(page: Page, slug: string): Promise<string> {
  const res = await page.request.get(`/api/v1/public/courses/${slug}`);
  return ((await res.json()) as { id: string }).id;
}
