import {
  type APIRequestContext,
  expect,
  type Page,
  type PlaywrightWorkerArgs,
  test,
} from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  latestSms,
  newPhone,
  SEED,
} from './helpers';

/** A tiny valid PNG, used as a "receipt photo". */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/** Creates a brand-new student through the API; the browser stays signed in as them. */
async function registerStudent(page: Page, name = `E2E Student ${unique()}`) {
  const phone = newPhone();
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: name,
      phone,
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { phone, name };
}

/** An admin session that is separate from the page, so the student stays signed in. */
async function adminApi(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string) {
  const api = await playwright.request.newContext({ baseURL });
  const res = await api.post('/api/v1/auth/sign-in', { data: SEED.owner });
  expect(res.ok(), `admin sign-in failed: ${res.status()}`).toBe(true);
  return api;
}

interface QueuedPayment {
  id: string;
  student: { fullName: string };
}

/** Finds a student's payment in the admin queue, looking through the pages. */
async function findPayment(api: APIRequestContext, studentName: string, status = 'SUBMITTED') {
  for (let page = 1; page <= 20; page++) {
    const res = await api.get(`/api/v1/admin/payments?status=${status}&page=${page}&pageSize=50`);
    const body = (await res.json()) as { items: QueuedPayment[]; total: number };
    const found = body.items.find((p) => p.student.fullName === studentName);
    if (found) return found;
    if (page * 50 >= body.total) break;
  }
  throw new Error(`No ${status} payment found for ${studentName}`);
}

/** Fills and sends the payment form as a student. */
async function submitPayment(page: Page, reference: string, withReceipt = true) {
  await page.getByLabel('Reference or transaction number').fill(reference);
  if (withReceipt) {
    await page.locator('input[type=file]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
  }
  await page.getByRole('button', { name: 'Submit payment' }).click();
}

test.describe('free course (AT-04, AT-09)', () => {
  test('a new student enrols with one tap, learns, and finishes', async ({ page }) => {
    await registerStudent(page);

    await page.goto('/courses/everyday-english');
    await page.getByRole('button', { name: 'Enrol free' }).click({ timeout: 15_000 });
    // Straight into the first lesson.
    await expect(page).toHaveURL(/\/learn\/everyday-english\/lessons\//, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Greeting people' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // The sample course has a quiz on this lesson, a second lesson and a final quiz.
    await expect(page.getByRole('link', { name: /Take the quiz/ }).first()).toBeVisible();
    await page.goto('/my-courses');
    await expect(page.getByRole('link', { name: /Everyday English/ })).toBeVisible();
    await page.goto('/learn/everyday-english');
    await expect(page.getByText('Introducing yourself')).toBeVisible();
    await expect(page.getByText('Daily life')).toBeVisible();
  });

  test('registering gives no access to a course', async ({ page }) => {
    await registerStudent(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 2, name: 'No courses yet' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // A direct link to a lesson explains why and offers the next step.
    await page.goto('/learn/everyday-english');
    await expect(page.getByRole('heading', { name: "You're not enrolled yet" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enrol free' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });

  test('registering from a course page brings you back able to enrol', async ({ page }) => {
    await page.goto('/courses/everyday-english');
    await page.getByRole('link', { name: 'Register to enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/register\?next=%2Fcourses%2Feveryday-english/);
    await page.getByLabel('Full name').fill(`E2E Visitor ${unique()}`);
    await page.getByLabel('Phone number').fill(newPhone());
    await page.getByLabel('Password', { exact: true }).fill('Natik-Test-2026!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/courses\/everyday-english$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Enrol free' })).toBeVisible({ timeout: 15_000 });
  });

  test('a visitor who is not signed in is asked to register', async ({ page }) => {
    await page.goto('/courses/everyday-english');
    await expect(page.getByRole('link', { name: 'Register to enrol' })).toBeVisible({
      timeout: 15_000,
    });
    await page.goto('/learn/everyday-english');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Flearn%2Feveryday-english/);
  });
});

test.describe('paid course (AT-05, AT-06, AT-07, AT-08)', () => {
  test('pay → under review → blocked → admin confirms → the course opens', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { phone, name } = await registerStudent(page);

    await page.goto('/courses/arabic-for-beginners');
    await page.getByRole('button', { name: 'Pay and enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/pay\//, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Pay and enrol' })).toBeVisible();
    await expect(page.getByText('ETB 1,500').first()).toBeVisible();
    await expect(page.getByText('1000123456789')).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy CBE/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // Mistakes are explained on the field.
    await page.getByRole('button', { name: 'Submit payment' }).click();
    await expect(page.getByText('Enter the reference from your receipt.')).toBeVisible();

    await submitPayment(page, `FT${unique()}${unique()}`);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });

    // Still blocked, with the right reason (AT-07).
    await page.goto('/learn/arabic-for-beginners');
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible();
    await expect(page.getByText(/You'll get an SMS when your access is ready/)).toBeVisible();
    await page.goto('/courses/arabic-for-beginners');
    await expect(page.getByRole('button', { name: /Payment under review/ })).toBeDisabled({
      timeout: 15_000,
    });

    // An admin checks the payment.
    const admin = await adminApi(playwright, baseURL!);
    const payment = await findPayment(admin, name);
    const confirmed = await admin.post(`/api/v1/admin/payments/${payment.id}/confirm`);
    expect(confirmed.ok()).toBe(true);
    // Checking twice is refused.
    expect((await admin.post(`/api/v1/admin/payments/${payment.id}/confirm`)).status()).toBe(409);

    await page.goto('/learn/arabic-for-beginners');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Arabic for Beginners' }),
    ).toBeVisible();
    expect(await latestSms(page, phone)).toContain('payment confirmed');
    await admin.dispose();
  });

  test('a rejected payment shows the reason and can be sent again', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { name } = await registerStudent(page);
    await page.goto('/courses/arabic-for-beginners');
    await page.getByRole('button', { name: 'Pay and enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/pay\//, { timeout: 15_000 });
    const reference = `RJ${unique()}${unique()}`;
    await submitPayment(page, reference, false);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });

    const admin = await adminApi(playwright, baseURL!);
    const payment = await findPayment(admin, name);
    const rejected = await admin.post(`/api/v1/admin/payments/${payment.id}/reject`, {
      data: { reason: 'Reference not found' },
    });
    expect(rejected.ok()).toBe(true);

    await page.goto('/profile/payments');
    await expect(page.getByText('Reference not found')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Send details again' }).click();
    await expect(page.getByText(/Reason: Reference not found/)).toBeVisible();

    // The same reference can be used again after a rejection; a different one is fine too.
    await submitPayment(page, reference, false);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });
    // Clean up so the queue doesn't fill with test payments.
    const again = await findPayment(admin, name);
    await admin.post(`/api/v1/admin/payments/${again.id}/reject`, {
      data: { reason: 'Test finished' },
    });
    await admin.dispose();
  });

  test("one student's payment page is not reachable by another", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const first = await registerStudent(page);
    await page.goto('/courses/arabic-for-beginners');
    await page.getByRole('button', { name: 'Pay and enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/pay\//, { timeout: 15_000 });
    const payUrl = new URL(page.url()).pathname;
    await submitPayment(page, `SE${unique()}${unique()}`, false);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });

    const admin = await adminApi(playwright, baseURL!);
    const payment = await findPayment(admin, first.name);

    // Another student opens the same address.
    await page.context().clearCookies();
    await registerStudent(page);
    await page.goto(payUrl);
    await expect(page.getByRole('heading', { name: "You can't open this" })).toBeVisible();

    await admin.post(`/api/v1/admin/payments/${payment.id}/reject`, {
      data: { reason: 'Test finished' },
    });
    await admin.dispose();
  });
});

test.describe('admin screens (desktop)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The admin screens are tried on a desktop.');
  });

  /** A new student pays for the Arabic course; returns their name. Leaves the browser signed in as the admin. */
  async function studentPaysThenAdminSignsIn(page: Page): Promise<string> {
    const { name } = await registerStudent(page);
    await page.goto('/courses/arabic-for-beginners');
    await page.getByRole('button', { name: 'Pay and enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/pay\//, { timeout: 15_000 });
    await submitPayment(page, `QU${unique()}${unique()}`);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });
    await page.context().clearCookies();
    const signIn = await page.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    expect(signIn.ok()).toBe(true);
    return name;
  }

  /** The student's card in the payment queue, looking through the pages (oldest first). */
  async function openCard(page: Page, name: string) {
    for (let n = 1; n <= 20; n++) {
      await page.goto(`/admin/payments?page=${n}`);
      const found = page.locator('li', { hasText: name }).first();
      if (await found.count()) return found;
      if ((await page.getByRole('link', { name: /^Next/ }).count()) === 0) break;
    }
    throw new Error('payment card not found');
  }

  test('payments queue: rejecting needs a reason', async ({ page }) => {
    const name = await studentPaysThenAdminSignsIn(page);
    const card = await openCard(page, name);
    await expect(card.getByText('Matches')).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    await card.getByRole('button', { name: 'Reject' }).click();
    await page.getByRole('button', { name: 'Reject payment' }).click();
    await expect(page.getByText('Please give a reason.')).toBeVisible();
    await page.getByLabel('Reason').fill('Amount short');
    await page.getByRole('button', { name: 'Reject payment' }).click();
    await expect(page.getByText('Payment rejected')).toBeVisible();
    await page.getByRole('link', { name: /^Rejected/ }).click();
    await expect(page.locator('li', { hasText: name }).first()).toContainText('Amount short');
  });

  test('payments queue: confirming can be undone for a few seconds', async ({ page }) => {
    const name = await studentPaysThenAdminSignsIn(page);
    let card = await openCard(page, name);

    // Confirm, then change your mind: the payment comes back and stays in the queue.
    await card.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Payment confirmed')).toBeVisible();
    await expect(page.locator('li', { hasText: name })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('li', { hasText: name }).first()).toBeVisible();

    // Confirm again and let the undo time run out: it is really confirmed.
    card = page.locator('li', { hasText: name }).first();
    await card.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('li', { hasText: name })).toHaveCount(0);
    // Nothing is sent until the undo time is over; then the server confirms it.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            '/api/v1/admin/payments?status=CONFIRMED&page=1&pageSize=50',
          );
          const body = (await res.json()) as { items: QueuedPayment[] };
          return body.items.some((p) => p.student.fullName === name);
        },
        { timeout: 20_000, intervals: [1000] },
      )
      .toBe(true);
    await page.getByRole('link', { name: /^Confirmed/ }).click();
    await expect(page.getByRole('link', { name: /^Confirmed \(\d+\)/ })).toBeVisible();
  });

  test('cash payment, enrolments list and payment accounts', async ({ page }) => {
    const { name } = await registerStudent(page);
    await page.context().clearCookies();
    const signIn = await page.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    expect(signIn.ok()).toBe(true);

    // Record cash for the new student.
    await page.goto('/admin/payments');
    await page.getByRole('button', { name: 'Record cash payment' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Student').fill(name.slice(-6));
    await dialog.getByRole('button', { name }).click();
    await dialog.getByLabel('Paid course').selectOption({ label: 'Arabic for Beginners' });
    await expect(dialog.getByLabel('Amount received (ETB)')).toHaveValue('1500');
    await dialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText(/Payment recorded/)).toBeVisible();

    // The enrolment shows up for that student, with the actions menu.
    await page.goto('/admin/enrolments');
    await page.getByRole('button', { name: 'Filter by student' }).click();
    await page.getByRole('dialog').getByLabel('Student').fill(name.slice(-6));
    await page.getByRole('dialog').getByRole('button', { name }).click();
    const row = page.locator('li', { hasText: name });
    await expect(row.getByText('Active')).toBeVisible();
    await row.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Extend access' }).click();
    await page.getByLabel('Days to add').fill('15');
    await page.getByRole('button', { name: 'Extend', exact: true }).click();
    await expect(page.getByText('Access extended')).toBeVisible();

    await row.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Cancel enrolment' }).click();
    await page.getByRole('button', { name: 'Cancel enrolment' }).click();
    await expect(page.getByText('Please give a reason.')).toBeVisible();
    await page.getByLabel('Reason').fill('Test finished');
    await page.getByRole('button', { name: 'Cancel enrolment' }).click();
    await expect(page.getByText('Enrolment cancelled').first()).toBeVisible();

    // Payment accounts are managed in settings.
    await page.goto('/admin/settings/payments');
    await expect(page.getByRole('heading', { level: 1, name: 'Payment accounts' })).toBeVisible();
    await expect(page.getByText('CBE (sample)')).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });
});

test.describe('screens fit the phone and are accessible', () => {
  test('dashboard, my courses, news, outline and payment history', async ({ page }) => {
    await registerStudent(page);
    await page.goto('/courses/everyday-english');
    await page.getByRole('button', { name: 'Enrol free' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/learn\//, { timeout: 15_000 });

    for (const path of [
      '/dashboard',
      '/my-courses',
      '/announcements',
      '/learn/everyday-english',
      '/profile/payments',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    }
  });

  test('"Report a problem" reaches the admin messages', async ({ page, playwright, baseURL }) => {
    const { name } = await registerStudent(page);
    await page.goto('/courses/everyday-english');
    await page.getByRole('button', { name: 'Enrol free' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/learn\/everyday-english\/lessons\//, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Report it' }).click();
    const message = `Video will not play ${unique()}`;
    await page.getByLabel('What happened?').fill(message);
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Thanks. We got your report.')).toBeVisible();

    const admin = await adminApi(playwright, baseURL!);
    const res = await admin.get('/api/v1/admin/messages?status=NEW&pageSize=50');
    const body = (await res.json()) as { items: { message: string; name: string }[] };
    expect(body.items.some((m) => m.message === message && m.name === name)).toBe(true);
    await admin.dispose();
  });
});
