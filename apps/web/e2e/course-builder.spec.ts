import { expect, type Page, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, SEED, signInAs } from './helpers';

/** A real one-page PDF, a tiny WAV, a PNG and an MP4 header: just enough for the server's real file checks. */
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
const WAV = Buffer.concat([
  Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1'),
  Buffer.alloc(64),
]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.alloc(2048),
]);

async function signOutAndIn(page: Page, account: { phone: string; password: string }) {
  await page.context().clearCookies();
  await signInAs(page, account);
}

/** Admin builds a course, assigns a teacher, the teacher builds and publishes a lesson (M3, AT-12). */
test.describe('course builder', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'the full journey runs on one phone and one desktop size',
    );
  });

  test('admin sets up a course and teacher; teacher builds, previews, publishes and hides a lesson', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const courseTitle = `Arabic for Beginners ${stamp}`;

    // ── Admin: a new level, then the course ────────────────────────────
    await signInAs(page, SEED.owner);
    await page.goto('/admin/settings/catalogue');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Languages and levels' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add a level' }).click();
    await page.getByLabel('Name').fill(`Level ${stamp}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(`Level ${stamp}`)).toBeVisible();

    await page.goto('/admin/courses/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New course' })).toBeVisible();
    // The form marks itself ready once it can take input.
    await expect(page.locator('form[data-ready]')).toBeAttached({ timeout: 20_000 });
    await page.getByLabel('Language', { exact: true }).selectOption({ label: 'Arabic' });
    await page.getByLabel('Level', { exact: true }).selectOption({ label: `Level ${stamp}` });
    await page.getByLabel('Course title').fill(courseTitle);
    await page
      .getByLabel('Short summary')
      .fill('Learn to read and write the Arabic alphabet with a patient teacher.');
    await expect(async () => {
      await page.locator('input[type=file]').first().setInputFiles({
        name: 'cover.png',
        mimeType: 'image/png',
        buffer: PNG,
      });
      await expect(page.locator('img[src^="/api/v1/files/"]').first()).toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole('radio', { name: 'Paid' }).click();
    await page.getByLabel('Price', { exact: true }).fill('1500');
    await page.getByLabel('Days of access').fill('90');
    // Saving: if a choice made while the page was still starting up was lost, the form says so and
    // highlights it; pick it again and save again, as a person would.
    await expect(async () => {
      const language = page.getByLabel('Language', { exact: true });
      const level = page.getByLabel('Level', { exact: true });
      if ((await language.inputValue()) === '') await language.selectOption({ label: 'Arabic' });
      if ((await level.inputValue()) === '') await level.selectOption({ label: `Level ${stamp}` });
      if (page.url().endsWith('/new')) {
        await page.getByRole('button', { name: 'Create course' }).click();
      }
      await expect(page).toHaveURL(/\/admin\/courses\/(?!new$)[a-z0-9]+$/, { timeout: 5000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: courseTitle })).toBeVisible();
    const courseId = page.url().split('/').pop()!;

    await page.getByRole('tab', { name: 'Teachers' }).click();
    await page.getByRole('checkbox', { name: 'Ustaz Ahmed' }).click();
    await page.getByRole('button', { name: 'Save teachers' }).click();
    await expect(page.getByText('Teachers saved.')).toBeVisible();

    // ── Teacher: sees only their courses ───────────────────────────────
    await signOutAndIn(page, SEED.teacher);
    await page.goto('/teach/courses');
    await expect(page.getByRole('link', { name: new RegExp(courseTitle) })).toBeVisible();
    await page.getByRole('link', { name: new RegExp(courseTitle) }).click();
    await expect(page.getByRole('heading', { level: 1, name: courseTitle })).toBeVisible();
    // Price and access are read-only for teachers (FR-TEACH-007).
    await expect(page.getByText('Price and access are set by an admin')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit course settings' })).toBeHidden();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // ── Units and a lesson ─────────────────────────────────────────────
    await page.getByRole('button', { name: 'Add week' }).first().click();
    await page.getByLabel('Week title').fill('Letters and sounds');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Letters and sounds/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add session' }).click();
    await page.getByLabel('Session title').fill('The alphabet');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-z0-9]+$/);
    await expect(page.getByRole('textbox', { name: 'Session title' })).toHaveValue('The alphabet');

    // Publishing an empty lesson explains what is missing.
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByText('Add at least one block')).toBeVisible();

    // Arabic text, set right to left
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Notes' });
    await editor.click();
    await page.getByRole('button', { name: 'Right to left' }).click();
    await page.keyboard.type('الفتحة ـَ');
    await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Files: PDF, audio, picture, video
    await page
      .getByTestId('file-pdf')
      .setInputFiles({ name: 'vowel-chart.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.getByText('vowel-chart.pdf')).toBeVisible();
    await page
      .getByTestId('file-audio')
      .setInputFiles({ name: 'vowels.wav', mimeType: 'audio/wav', buffer: WAV });
    await expect(page.getByText('vowels.wav')).toBeVisible();
    await page
      .getByTestId('file-image')
      .setInputFiles({ name: 'letters.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByLabel('Describe the picture')).toBeVisible();
    await page
      .getByTestId('file-video')
      .setInputFiles({ name: 'Vowels song.mp4', mimeType: 'video/mp4', buffer: MP4 });
    await expect(page.getByText('Vowels song')).toBeVisible();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expectNoSeriousA11yIssues(page);

    // ── Preview: exactly what students see ─────────────────────────────
    await page.getByRole('link', { name: 'Preview' }).first().click();
    await expect(page).toHaveURL(/\/preview$/);
    await expect(page.getByText('Preview: this is how students see the session.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'The alphabet' })).toBeVisible();
    await expect(page.locator('.lesson-prose [dir="rtl"]').first()).toContainText('الفتحة');
    await expect(page.locator('article')).toHaveAttribute('dir', 'rtl');

    // The video loads only after a tap
    await expect(page.locator('video')).toHaveCount(0);
    await page.getByRole('button', { name: /Play video: Vowels song/ }).click();
    await expect(page.locator('video')).toHaveCount(1);

    // The PDF opens inside the page
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByText('Page 1 of 1')).toBeVisible({ timeout: 30_000 });

    // Audio speed changes
    await page.getByRole('button', { name: /Speed 1 times/ }).click();
    await expect(page.getByRole('button', { name: /Speed 1.25 times/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // ── Publish, hide, publish again ───────────────────────────────────
    await page.getByRole('link', { name: 'Back to editor' }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByText('Session published. Students see it now.')).toBeVisible();
    await expect(page.getByText(/This session is live/)).toBeVisible();
    await page.getByRole('button', { name: 'Hide', exact: true }).last().click();
    await expect(page.getByText('Session hidden.')).toBeVisible();
    // A toast can sit over the sticky bar on a phone, so the click is sent to the button itself.
    await page.getByRole('button', { name: 'Publish again' }).last().dispatchEvent('click');
    await expect(page.getByText('Session published. Students see it now.').last()).toBeVisible();

    // A published lesson can be hidden but not deleted
    await page.goto(`/teach/courses/${courseId}`);
    await page.getByRole('button', { name: /Actions for The alphabet/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Teachers stay out of admin pages
    await page.goto('/admin/courses');
    await expect(page).toHaveURL(/\/teach/);
  });

  test('a teacher cannot open a course they are not assigned to', async ({ page }) => {
    await signInAs(page, SEED.owner);
    const languages = (await (await page.request.get('/api/v1/admin/languages')).json()) as {
      items: { id: string }[];
    };
    const levels = (await (await page.request.get('/api/v1/admin/levels')).json()) as {
      items: { id: string }[];
    };
    const created = await page.request.post('/api/v1/admin/courses', {
      data: {
        title: `Someone else's course ${Date.now()}`,
        languageId: languages.items[0]!.id,
        levelId: levels.items[0]!.id,
        summary: 'A course this teacher is not assigned to.',
        outcomes: [],
        access: 'FREE',
      },
    });
    expect(created.ok()).toBe(true);
    const course = (await created.json()) as { id: string };

    await signOutAndIn(page, SEED.teacher);
    await page.goto(`/teach/courses/${course.id}`);
    await expect(page.getByRole('heading', { name: "You can't open this" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My courses' }).last()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

/** Large files must get through the website's proxy to the API, and oversize ones get the plain message (FR-TEACH-004). */
test.describe('large uploads', () => {
  test('a 20 MB PDF uploads; a 32 MB PDF is refused in plain words', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one size is enough for the upload path');
    test.setTimeout(120_000);
    await signInAs(page, SEED.owner);
    const languages = (await (await page.request.get('/api/v1/admin/languages')).json()) as {
      items: { id: string }[];
    };
    const levels = (await (await page.request.get('/api/v1/admin/levels')).json()) as {
      items: { id: string }[];
    };
    const created = await page.request.post('/api/v1/admin/courses', {
      data: {
        title: `Upload test ${Date.now()}`,
        languageId: languages.items[0]!.id,
        levelId: levels.items[0]!.id,
        summary: 'A course used to test large uploads.',
        outcomes: [],
        access: 'FREE',
      },
    });
    const course = (await created.json()) as { id: string };
    const users = (await (await page.request.get('/api/v1/admin/users?q=Ustaz')).json()) as {
      items: { id: string }[];
    };
    await page.request.put(`/api/v1/admin/courses/${course.id}/teachers`, {
      data: { teacherIds: [users.items[0]!.id] },
    });

    await signOutAndIn(page, SEED.teacher);
    const pdfOf = (megabytes: number) =>
      Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(Math.round(megabytes * 1024 * 1024))]);

    const ok = await page.request.post('/api/v1/files', {
      multipart: {
        purpose: 'LESSON_PDF',
        courseId: course.id,
        file: { name: 'big.pdf', mimeType: 'application/pdf', buffer: pdfOf(20) },
      },
    });
    expect(ok.status()).toBe(201);

    const tooBig = await page.request.post('/api/v1/files', {
      multipart: {
        purpose: 'LESSON_PDF',
        courseId: course.id,
        file: { name: 'huge.pdf', mimeType: 'application/pdf', buffer: pdfOf(31.5) },
      },
    });
    expect(tooBig.status()).toBe(413);
    expect(((await tooBig.json()) as { error: { message: string } }).error.message).toBe(
      'This file is 32 MB. The maximum is 25 MB.',
    );
  });
});

/** Quick checks on every screen size: the new pages load, fit the screen and pass the accessibility scan. */
test.describe('course builder screens fit every phone', () => {
  test('admin course pages', async ({ page }) => {
    await signInAs(page, SEED.owner);
    for (const path of [
      '/admin/courses',
      '/admin/courses/new',
      '/admin/settings',
      '/admin/settings/catalogue',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    }
  });

  test('teacher pages', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    for (const path of ['/teach', '/teach/courses']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    }
  });
});
