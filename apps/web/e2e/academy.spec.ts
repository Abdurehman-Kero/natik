import { expect, type Page, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, newPhone, SEED } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const text = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

/** Learning academy, phase A: guided lessons, slides, opening in order, and the public additions. */
test.describe('public additions', () => {
  test('the home page explains how learning works and offers the level check', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'How learning works' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your path from beginner/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Find your level/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the student quotes slide by themselves once reached, stop on hover, and can be paused', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const slides = page.getByRole('region', { name: 'Students say' });
    await slides.scrollIntoViewIfNeeded();
    const track = slides.locator('.marquee-track');
    const x = async () => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    const start = await x();
    await expect.poll(x, { timeout: 15_000 }).toBeLessThan(start - 5);

    // Hovering stops it (phones have no hover, so this is checked with a pointer only).
    if (!testInfo.project.name.includes('phone') && testInfo.project.name !== 'mobile') {
      await slides.hover();
      await page.waitForTimeout(400);
      const held = await x();
      await page.waitForTimeout(1200);
      expect(Math.abs((await x()) - held)).toBeLessThan(1);
      await page.mouse.move(0, 0);
    }
    await page.getByRole('button', { name: 'Pause slideshow' }).click();
    await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('"Find your level" asks a few questions and suggests where to start', async ({ page }) => {
    await page.goto('/find-your-level');
    await expect(page.getByRole('heading', { level: 1, name: 'Find your level' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await page.getByRole('main').getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('list', { name: 'Answers' })).toBeVisible({ timeout: 15_000 });
    for (let n = 0; n < 12; n++) {
      const answers = page.getByRole('list', { name: 'Answers' });
      if (!(await answers.isVisible().catch(() => false))) break;
      await answers.getByRole('button').first().click();
      await page.waitForTimeout(80);
    }
    await expect(page.getByText(/^Start at /)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/You answered \d+ of \d+ correctly/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: /Which language/ })).toBeVisible();
  });

  test('the teachers page and the footer links work', async ({ page }) => {
    await page.goto('/teachers');
    await expect(page.getByRole('heading', { level: 1, name: 'Our teachers' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await page.getByRole('link', { name: 'Find your level' }).last().click();
    await expect(page).toHaveURL(/\/find-your-level/);
  });

  test('a course page folds its lessons away and links its free lessons', async ({ page }) => {
    await page.goto('/courses/everyday-english');
    await expect(page.getByRole('heading', { name: 'Course outline' })).toBeVisible();
    await expect(page.locator('details').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });
});

async function admin(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string) {
  const api = await playwright.request.newContext({ baseURL });
  const res = await api.post('/api/v1/auth/sign-in', { data: SEED.owner });
  expect(res.ok(), `admin sign-in failed: ${res.status()}`).toBe(true);
  return api;
}

async function registerStudent(page: Page) {
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: `Academy Student ${unique()}`,
      phone: newPhone(),
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
}

test.describe('guided lessons', () => {
  test('a student walks through the steps and slides, resumes, and lessons open in order', async ({
    page,
    playwright,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
    const api = await admin(playwright, baseURL!);
    const filters = await (await api.get('/api/v1/public/filters')).json();
    const picture = await (
      await api.post('/api/v1/files', {
        multipart: {
          purpose: 'COURSE_IMAGE',
          file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
        },
      })
    ).json();
    const title = `Guided course ${unique()}`;
    const course = await (
      await api.post('/api/v1/admin/courses', {
        data: {
          title,
          languageId: filters.languages[0].id,
          levelId: filters.levels[0].id,
          summary: 'A course made by the browser test.',
          outcomes: [],
          access: 'FREE',
          imageFileId: picture.id,
          lessonOrder: 'IN_ORDER',
        },
      })
    ).json();
    const unit = await (
      await api.post(`/api/v1/teach/courses/${course.id}/units`, { data: { title: 'Unit one' } })
    ).json();

    const lessons: string[] = [];
    for (const name of ['First lesson', 'Second lesson']) {
      const lesson = await (
        await api.post(`/api/v1/teach/units/${unit.id}/lessons`, { data: { title: name } })
      ).json();
      lessons.push(lesson.id);
    }
    await api.patch(`/api/v1/teach/lessons/${lessons[0]}`, {
      data: {
        description: 'Say hello to people.',
        objectives: ['Greet a friend', 'Introduce yourself'],
        estimatedMinutes: 12,
      },
    });
    const deck = await (
      await api.post(`/api/v1/teach/lessons/${lessons[0]}/blocks`, {
        data: { type: 'SLIDES', stage: 'PREPARE' },
      })
    ).json();
    await api.post(`/api/v1/teach/blocks/${deck.id}/slides`, {
      data: { title: 'Slide one', body: 'Hello', keywords: ['salaam'] },
    });
    await api.post(`/api/v1/teach/blocks/${deck.id}/slides`, {
      data: { title: 'Slide two', body: 'Goodbye' },
    });
    await api.post(`/api/v1/teach/lessons/${lessons[0]}/blocks`, {
      data: { type: 'TEXT', textJson: text('The main part of lesson one.') },
    });
    await api.post(`/api/v1/teach/lessons/${lessons[1]}/blocks`, {
      data: { type: 'TEXT', textJson: text('Lesson two body.') },
    });
    for (const id of lessons) await api.post(`/api/v1/teach/lessons/${id}/publish`);
    await api.post(`/api/v1/teach/units/${unit.id}/publish`);
    const published = await api.post(`/api/v1/admin/courses/${course.id}/publish`);
    expect(published.ok(), await published.text()).toBe(true);

    // The student enrols and lands in the first lesson, on the intro.
    await registerStudent(page);
    await page.goto(`/courses/${course.slug}`);
    await page.getByRole('button', { name: 'Enrol free' }).click({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/learn\/.*\/lessons\//, { timeout: 15_000 });
    const steps = page.getByRole('navigation', { name: 'Lesson steps' });
    await expect(steps.getByRole('button', { name: /Intro/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByText('Greet a friend')).toBeVisible();
    await expect(page.getByText('About 12 minutes')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // Next step: the slides, one at a time.
    const bar = page.getByRole('navigation', { name: /Lesson 1 of 2/ });
    await bar.getByRole('button', { name: 'Next step' }).click();
    await expect(page.getByRole('heading', { name: 'Slide one' })).toBeVisible();
    await expect(page.getByText('salaam')).toBeVisible();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByRole('heading', { name: 'Slide two' })).toBeVisible();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Previous slide' }).click();
    await expect(page.getByRole('heading', { name: 'Slide one' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await bar.getByRole('button', { name: 'Next step' }).click();
    await expect(page.getByText('The main part of lesson one.')).toBeVisible();
    // The last step offers to complete the lesson.
    await expect(bar.getByRole('button', { name: 'Mark as complete' })).toBeVisible();

    // Leaving and coming back resumes on the same step.
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText('The main part of lesson one.')).toBeVisible();

    // Lesson two is closed until lesson one is done.
    await page.goto(`/learn/${course.slug}/lessons/${lessons[1]}`);
    await expect(
      page.getByRole('heading', { name: 'Finish the earlier lesson first' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Go to that lesson' }).click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lessons[0]}`));

    await page.getByRole('button', { name: 'Mark as complete' }).click();
    await expect(page.getByText('Completed').first()).toBeVisible();
    await page.goto(`/learn/${course.slug}/lessons/${lessons[1]}`);
    await expect(page.getByText('Lesson two body.')).toBeVisible();
    await api.dispose();
  });
});
