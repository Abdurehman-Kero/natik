import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  latestSms,
  newPhone,
  SEED,
  signInAs,
  waitForPageReady,
} from './helpers';

/**
 * The whole life of one premium course, through the real screens, with a screenshot at every step:
 *
 *   admin creates the course and assigns a teacher → the teacher adds a lesson with text, a PDF and a
 *   video, and publishes it → the admin publishes the course → a visitor finds it, registers and pays →
 *   the course stays locked while the payment is checked → the admin confirms the payment → the student
 *   opens the lesson, video and PDF → the teacher sees the student's progress and messages them.
 *
 * Screenshots are saved in docs/test-screenshots/journey/<screen size>/.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
    'trailer<</Root 1 0 R/Size 4>>',
    '%%EOF',
  ].join('\n'),
);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.alloc(2048),
]);

const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/journey');

test.describe('one course from creation to a paying student', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'the full journey runs on one phone and one desktop size',
    );
  });

  test('admin creates → teacher uploads → student pays → admin confirms → student learns → teacher follows up', async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    let step = 0;
    const snap = async (name: string) => {
      await waitForPageReady(page);
      step += 1;
      await page.screenshot({
        path: path.join(
          SHOTS,
          testInfo.project.name,
          `${String(step).padStart(2, '0')}-${name}.png`,
        ),
        fullPage: true,
        // Finish the page's fade-in so the picture shows the real colours.
        animations: 'disabled',
      });
    };
    const switchTo = async (account: { phone: string; password: string }) => {
      await page.context().clearCookies();
      await signInAs(page, account);
    };

    const stamp = Date.now();
    const title = `Journey course ${testInfo.project.name} ${stamp}`;
    const student = {
      name: `Journey Student ${stamp.toString(36).toUpperCase()}`,
      phone: newPhone(),
      password: 'Journey-2026!',
    };

    // ── 1. Admin creates a premium course ───────────────────────────────
    await switchTo(SEED.owner);
    await page.goto('/admin/courses/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New course' })).toBeVisible();
    // The form marks itself ready once it can take input.
    await expect(page.locator('form[data-ready]')).toBeAttached({ timeout: 20_000 });
    await page.getByLabel('Language', { exact: true }).selectOption({ label: 'English' });
    await page.getByLabel('Level', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Course title').fill(title);
    await page
      .getByLabel('Short summary')
      .fill('Everyday English for work: emails, meetings and phone calls, step by step.');
    await expect(async () => {
      await page
        .locator('input[type=file]')
        .first()
        .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
      await expect(page.locator('img[src^="/api/v1/files/"]').first()).toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole('radio', { name: 'Paid' }).click();
    await page.getByLabel('Price', { exact: true }).fill('1200');
    await page.getByLabel('Days of access').fill('30');
    await snap('admin-new-course-form');
    // Payment is arranged with Natik support: the website shows "Premium" instead of an amount.
    await page.getByRole('switch', { name: /Show the price on the public website/ }).click();
    await expect(
      page.getByRole('switch', { name: /Show the price on the public website/ }),
    ).not.toBeChecked();
    // Saving: if a choice made while the page was still starting up was lost, the form says so and
    // highlights it; pick it again and save again, as a person would.
    await expect(async () => {
      const language = page.getByLabel('Language', { exact: true });
      const level = page.getByLabel('Level', { exact: true });
      if ((await language.inputValue()) === '') await language.selectOption({ label: 'English' });
      if ((await level.inputValue()) === '') await level.selectOption({ index: 1 });
      if (page.url().endsWith('/new')) {
        await page.getByRole('button', { name: 'Create course' }).click();
      }
      await expect(page).toHaveURL(/\/admin\/courses\/(?!new$)[a-z0-9]+$/, { timeout: 5000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const courseId = page.url().split('/').pop()!;
    await snap('admin-course-created');

    await page.getByRole('tab', { name: 'Teachers' }).click();
    await page.getByRole('checkbox', { name: 'Ustaz Ahmed' }).click();
    await page.getByRole('button', { name: 'Save teachers' }).click();
    await expect(page.getByText('Teachers saved.')).toBeVisible();
    await snap('admin-teacher-assigned');

    // ── 2. The teacher builds a lesson with text, a PDF and a video ─────
    await switchTo(SEED.teacher);
    await page.goto('/teach/courses');
    await page.getByRole('link', { name: new RegExp(title) }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Add unit' }).first().click();
    await page.getByLabel('Unit title').fill('Writing emails');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Writing emails/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add lesson' }).click();
    await page.getByLabel('Lesson title').fill('A polite first email');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-z0-9]+$/);

    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Lesson text' }).click();
    await page.keyboard.type('Start with a greeting, say why you are writing, and end politely.');
    await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByTestId('file-pdf')
      .setInputFiles({ name: 'email-phrases.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.getByText('email-phrases.pdf')).toBeVisible();
    await page
      .getByTestId('file-video')
      .setInputFiles({ name: 'Writing an email.mp4', mimeType: 'video/mp4', buffer: MP4 });
    await expect(page.getByText('Writing an email')).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 30_000 });
    await snap('teacher-lesson-with-pdf-and-video');

    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByText('Lesson published.')).toBeVisible();
    await snap('teacher-lesson-published');

    // ── 3. The admin publishes the course ───────────────────────────────
    await switchTo(SEED.owner);
    await page.goto(`/admin/courses/${courseId}`);
    await page.getByRole('button', { name: 'Publish', exact: true }).first().click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByText('Course published.')).toBeVisible();
    await snap('admin-course-published');

    // ── 4. A visitor finds the course on the website ────────────────────
    await page.context().clearCookies();
    // The public list is refreshed every few seconds, so a just-published course can take a moment.
    const card = page.getByRole('link', { name: new RegExp(title) }).first();
    await expect(async () => {
      await page.goto('/courses?type=premium');
      await expect(card).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await snap('public-premium-courses');
    await card.click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const slug = new URL(page.url()).pathname.split('/').pop()!;
    // No amount on the public page; visitors are pointed to Natik support instead.
    await expect(page.getByText('Premium course').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText('ETB');
    // The teacher's published unit and lesson are listed for visitors.
    await expect(page.getByText('Writing emails').first()).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: 'A polite first email' }),
    ).toBeVisible();
    await snap('public-course-page');

    // ── 5. They register from the course page and pay ───────────────────
    await page.getByRole('link', { name: 'Register to enrol' }).click({ timeout: 15_000 });
    await page.getByLabel('Full name').fill(student.name);
    await page.getByLabel('Phone number').fill(student.phone);
    await page.getByLabel('Password', { exact: true }).fill(student.password);
    await page.getByRole('checkbox').check();
    await snap('student-register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${slug}$`), { timeout: 15_000 });

    await page.getByRole('button', { name: 'Pay and enrol' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/pay\//, { timeout: 15_000 });
    await expect(page.getByText('ETB 1,200').first()).toBeVisible();
    await snap('student-payment-page');
    await page.getByLabel('Reference or transaction number').fill(`JR${stamp}`);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Submit payment' }).click();
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible({
      timeout: 15_000,
    });
    await snap('student-payment-under-review');

    // Locked until the payment is checked.
    await page.goto(`/learn/${slug}`);
    await expect(page.getByRole('heading', { name: 'Payment under review' })).toBeVisible();
    await snap('student-course-locked');

    // ── 6. The admin confirms the payment in the queue ──────────────────
    await switchTo(SEED.owner);
    let paymentCard = page.locator('li', { hasText: student.name }).first();
    for (let n = 1; n <= 20; n++) {
      await page.goto(`/admin/payments?page=${n}`);
      paymentCard = page.locator('li', { hasText: student.name }).first();
      if (await paymentCard.count()) break;
      if ((await page.getByRole('link', { name: /^Next/ }).count()) === 0) break;
    }
    await expect(paymentCard).toBeVisible();
    await expect(paymentCard).toContainText(title);
    await snap('admin-payment-queue');
    await paymentCard.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Payment confirmed')).toBeVisible();
    // Confirming can be undone for a few seconds; then the server records it.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(
            '/api/v1/admin/payments?status=CONFIRMED&page=1&pageSize=50',
          );
          const body = (await res.json()) as { items: { student: { fullName: string } }[] };
          return body.items.some((p) => p.student.fullName === student.name);
        },
        { timeout: 30_000, intervals: [1000] },
      )
      .toBe(true);
    await snap('admin-payment-confirmed');

    // ── 7. The student now has the course: lesson, PDF and video ────────
    await switchTo(student);
    expect(await latestSms(page, student.phone)).toContain('payment confirmed');
    await page.goto('/my-courses');
    await expect(page.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible();
    await snap('student-my-courses');
    await page.goto(`/learn/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await snap('student-course-open');
    await page
      .getByRole('link', { name: /A polite first email/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'A polite first email' }),
    ).toBeVisible();
    await expect(page.getByText('Start with a greeting')).toBeVisible();
    await page.getByRole('button', { name: /Play video: Writing an email/ }).click();
    await expect(page.locator('video')).toHaveCount(1);
    await expect(page.getByText('email-phrases.pdf')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await snap('student-lesson-video-and-pdf');

    // ── 8. The teacher follows the student and writes to them ───────────
    await switchTo(SEED.teacher);
    await page.goto(`/teach/courses/${courseId}/students`);
    const row = page.locator('li', { hasText: student.name });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await expect(row).not.toContainText('Not active yet');
    await snap('teacher-students-progress');
    await row.getByRole('link', { name: `Message ${student.name}` }).click();
    await expect(page).toHaveURL(/\/teach\/chat\?c=/, { timeout: 15_000 });
    await expect(page.getByText(student.name).first()).toBeVisible();
    const box = page.getByRole('textbox', { name: 'Write a message' });
    const send = page.getByRole('button', { name: 'Send', exact: true });
    // The conversation finishes loading after the address changes; type once it is ready.
    await expect(async () => {
      await box.fill('Welcome to the course! Ask me anything about the first lesson.');
      await expect(send).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await send.click();
    await expect(
      page.getByText('Welcome to the course!').filter({ visible: true }).first(),
    ).toBeVisible();
    await snap('teacher-messages-student');

    // ── 9. The student sees the teacher's message ───────────────────────
    await switchTo(student);
    await page.goto('/chat');
    await page
      .getByRole('button', { name: /Ustaz Ahmed/ })
      .first()
      .click();
    await expect(
      page.getByText('Welcome to the course!').filter({ visible: true }).first(),
    ).toBeVisible();
    await snap('student-reads-teacher-message');
  });
});
