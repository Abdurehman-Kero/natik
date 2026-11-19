import { expect, request, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  SEED,
  signInAs,
  newContact,
} from './helpers';

/** Public content is cached for a few seconds, so look again until it shows what was just saved. */
async function until(page: import('@playwright/test').Page, check: () => Promise<void>) {
  await expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
}

const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/** The Help tab for students and teachers: a video set by the admin, and a written guide. */
test.describe('help tab', () => {
  // The help videos are one shared setting, so these tests take turns and only the desktop run changes them.
  test.describe.configure({ mode: 'serial' });

  test('a student finds Help in the menu, with the video and the written guide', async ({
    page,
    baseURL,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'desktop';
    const admin = await request.newContext({ baseURL: baseURL! });
    if (desktop) {
      // The admin adds the student video first.
      expect((await admin.post('/api/v1/auth/sign-in', { data: SEED.owner })).ok()).toBe(true);
      const saved = await admin.put('/api/v1/admin/site/help', {
        data: { studentVideoUrl: VIDEO, teacherVideoUrl: '' },
      });
      expect(saved.ok(), await saved.text()).toBe(true);
      // Anything that is not a YouTube or Vimeo link is refused.
      const bad = await admin.put('/api/v1/admin/site/help', {
        data: { studentVideoUrl: 'https://example.com/video.mp4' },
      });
      expect(bad.status()).toBe(400);
    }

    const registered = await page.request.post('/api/v1/auth/register', {
      data: {
        fullName: 'Help Student',
        ...newContact(),
        password: 'Passw0rd123',
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(registered.status()).toBe(201);
    await page.goto('/dashboard');
    if (testInfo.project.name === 'desktop') {
      await page.getByRole('complementary').getByRole('link', { name: 'Help' }).click();
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('dialog').getByRole('link', { name: 'Help', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();

    // The video is the first sub-tab; the player loads only after a tap.
    await expect(page.getByRole('tab', { name: 'Video' })).toHaveAttribute('aria-selected', 'true');
    if (desktop) {
      await until(page, () =>
        expect(page.getByRole('button', { name: /Watch the trailer/ })).toBeVisible({
          timeout: 800,
        }),
      );
      await expect(page.locator('iframe')).toHaveCount(0);
    }
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // The written guide lists every step.
    await page.getByRole('tab', { name: 'Written guide' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create your account and sign in' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Get your certificate' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    if (desktop) await admin.delete('/api/v1/admin/site/help');
    await admin.dispose();
  });

  test('a teacher has a Help tab too, with the teacher video and guide', async ({
    page,
    baseURL,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'one size is enough');
    const admin = await request.newContext({ baseURL: baseURL! });
    await admin.post('/api/v1/auth/sign-in', { data: SEED.owner });
    await admin.put('/api/v1/admin/site/help', {
      data: { teacherVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
    });
    await signInAs(page, SEED.teacher);
    await page.goto('/teach');
    await page.getByRole('complementary').getByRole('link', { name: 'Help' }).click();
    await expect(page).toHaveURL(/\/teach\/guide$/);
    await until(page, () =>
      expect(page.getByRole('button', { name: /Watch the trailer/ })).toBeVisible({ timeout: 800 }),
    );
    await page.getByRole('tab', { name: 'Written guide' }).click();
    await expect(page.getByRole('heading', { name: 'Add weeks and sessions' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await admin.delete('/api/v1/admin/site/help');
    await admin.dispose();
  });

  test('without a video the page says it is coming and the guide still works', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one size is enough');
    await page.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    await page.request.delete('/api/v1/admin/site/help');
    await page.context().clearCookies();
    await signInAs(page, SEED.student);
    await page.goto('/guide');
    await until(page, () =>
      expect(page.getByRole('heading', { name: 'The video is coming soon' })).toBeVisible({
        timeout: 800,
      }),
    );
    await page.getByRole('tab', { name: 'Written guide' }).click();
    await expect(page.getByRole('heading', { name: 'Find a course' })).toBeVisible();
  });

  test('the admin sets the help videos in Website › Help videos', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one size is enough');
    await signInAs(page, SEED.owner);
    await page.goto('/admin/website');
    await page.getByRole('tab', { name: 'Help videos' }).click();
    await page.getByLabel('Student video').fill('https://example.com/nope');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/YouTube or Vimeo/).first()).toBeVisible();
    await page.getByLabel('Student video').fill(VIDEO);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved').first()).toBeVisible();
    await page.request.delete('/api/v1/admin/site/help');
  });
});
