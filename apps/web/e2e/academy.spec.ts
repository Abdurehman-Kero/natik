import { expect, type Page, type PlaywrightWorkerArgs, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  joinCourse,
  SEED,
  newContact,
} from './helpers';

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
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your path from beginner/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Find your level/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the student quotes move on by themselves, stop while you read, and can be controlled', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const slides = page.getByRole('region', { name: 'What our students say' });
    await slides.scrollIntoViewIfNeeded();
    // Which quote is showing: the dot that is marked as current (quotes can repeat in test data).
    const current = async () =>
      slides.locator('button[aria-current="true"]').getAttribute('aria-label');
    const first = await current();
    expect(first).toMatch(/^Show quote 1 of/);

    // It moves on by itself (a quote stays about 8 seconds).
    await expect.poll(current, { timeout: 20_000 }).not.toBe(first);

    // Next and the dots move it by hand.
    await slides.getByRole('button', { name: /^Show quote 1 of/ }).click();
    await expect.poll(current).toBe(first);
    await slides.getByRole('button', { name: 'Next quote' }).click();
    await expect.poll(current).toMatch(/^Show quote 2 of/);
    await slides.getByRole('button', { name: 'Previous quote' }).click();
    await expect.poll(current).toBe(first);

    // Hovering stops it (phones have no hover, so this is checked with a pointer only).
    if (!testInfo.project.name.includes('phone') && testInfo.project.name !== 'mobile') {
      await slides.hover();
      const held = await current();
      await page.waitForTimeout(9_000);
      expect(await current()).toBe(held);
      await page.mouse.move(0, 0);
    }
    await slides.getByRole('button', { name: 'Pause slideshow' }).click();
    await expect(slides.getByRole('button', { name: 'Play slideshow' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the home page shows what you can do as tabs of courses and teachers', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'See what you can do on Natik' })).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toBeVisible();
    await page.getByRole('tab', { name: 'Teachers' }).click();
    await expect(page.getByRole('link', { name: 'All teachers' })).toBeVisible();
    await page.getByRole('tab', { name: 'Premium' }).click();
    await expect(page.getByRole('link', { name: 'See all premium courses' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the navy footer has the sitemap, legal links, contact details and social links', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('heading', { name: 'Sitemap' })).toBeVisible();
    await expect(footer.getByRole('heading', { name: 'Legal' })).toBeVisible();
    await expect(footer.getByRole('heading', { name: 'Contact' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Courses' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'English' })).toBeVisible();
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
    // "Find your level" in the footer opens the questions in a dialog on the same page.
    await page.getByRole('contentinfo').getByRole('button', { name: 'Find your level' }).click();
    await expect(page.getByRole('dialog', { name: 'Find your level' })).toBeVisible();
  });

  test('a course page folds its weeks away and lists the sessions, locked', async ({ page }) => {
    await page.goto('/courses/everyday-english');
    await page.getByRole('tab', { name: 'Content' }).click();
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
      ...newContact(),
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

    // The student joins (an admin accepts) and opens the first session, on the intro.
    await registerStudent(page);
    await joinCourse(page, course.id);
    await page.goto(`/learn/${course.slug}/lessons/${lessons[0]}`);
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
    const bar = page.getByRole('navigation', { name: /Session 1 of 2/ });
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
      page.getByRole('heading', { name: 'Finish the earlier session first' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Go to that session' }).click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lessons[0]}`));

    const [completed] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/complete') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Mark as complete' }).click(),
    ]);
    expect(completed.status(), await completed.text()).toBe(200);
    await page.goto(`/learn/${course.slug}/lessons/${lessons[1]}`);
    await expect(page.getByText('Lesson two body.')).toBeVisible();
    await api.dispose();
  });
});
