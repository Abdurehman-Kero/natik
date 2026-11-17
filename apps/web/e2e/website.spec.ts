import { expect, type Page, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, SEED, signInAs } from './helpers';

async function signOutAndIn(page: Page, account: { phone: string; password: string }) {
  await page.context().clearCookies();
  await signInAs(page, account);
}

/**
 * Public pages are cached and refreshed when an admin saves, so a change can take a moment to show.
 * Reloads the page until the text appears (FR-WEB-005: "within seconds").
 */
async function expectSoonOn(page: Page, path: string, text: string) {
  await expect
    .poll(
      async () => {
        await page.goto(path);
        return page.getByText(text).count();
      },
      { timeout: 20_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(0);
}

/** The home page headline, reloading until the cached page has refreshed. */
async function homeHeadlineSoon(page: Page) {
  return async () => {
    await page.goto('/');
    return (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  };
}

/** Free lessons, the website editor, the inbox and announcements (M4, AT-01, FR-WEB-005). */
test.describe('free lessons', () => {
  test('a visitor opens a free lesson without signing in', async ({ page }) => {
    await page.goto('/free-lessons');
    await expect(page.getByRole('heading', { level: 1, name: 'Free lessons' })).toBeVisible();
    const card = page.locator('main a[href*="/lessons/"]').first();
    await expect(card).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await card.click();
    await expect(page).toHaveURL(/\/courses\/[^/]+\/lessons\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main').getByRole('paragraph').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create free account' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('a lesson address that is not a free preview is simply not found', async ({ page }) => {
    const response = await page.goto('/courses/arabic-for-beginners/lessons/not-a-real-lesson');
    // Pages stream in each visitor's language, so the status is sent before the page knows; Next.js
    // then marks the not-found page "noindex" so search engines drop it.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(
      page.getByRole('heading', { name: /couldn.t find|not found/i }).first(),
    ).toBeVisible();
  });

  test('the course page links its free lessons', async ({ page }) => {
    await page.goto('/free-lessons');
    const href = await page.locator('main a[href*="/lessons/"]').first().getAttribute('href');
    const slug = href!.split('/')[2]!;
    await page.goto(`/courses/${slug}`);
    await expect(page.locator('main a[href*="/lessons/"]').first()).toBeVisible();
  });
});

test.describe('website editor', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'the editing journey runs on one phone and one desktop size',
    );
  });

  test('admin changes the headline and a FAQ item; the public site updates at once', async ({
    page,
  }, testInfo) => {
    // The site has one headline, so only one screen size may change it at a time.
    test.skip(testInfo.project.name !== 'desktop', 'edits shared site content: desktop only');
    test.setTimeout(120_000);
    await signInAs(page, SEED.owner);
    try {
      await page.goto('/admin/website');
      const headline = `Learn with Natik ${Date.now()}`;
      await page.getByLabel('Headline', { exact: true }).fill(headline);
      await page.getByLabel('Line under the headline').fill('Clear lessons, at your own pace.');
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      await expect(page.getByText('Saved. The website is updated.')).toBeVisible();

      await expect.poll(await homeHeadlineSoon(page), { timeout: 20_000 }).toBe(headline);

      // FAQ: add a question, see it on /faq, then remove it
      await page.goto('/admin/website');
      await page.getByRole('tab', { name: 'FAQ' }).click();
      await page.getByRole('button', { name: 'Add a question' }).click();
      const question = `Can I pay by bank? ${Date.now()}`;
      await page.getByRole('textbox', { name: 'Question' }).fill(question);
      await page
        .getByRole('textbox', { name: 'Answer' })
        .fill('Yes. Send the transfer reference and we confirm it.');
      await page.getByRole('button', { name: 'Save', exact: true }).last().click();
      await expect(page.getByText(question)).toBeVisible();
      await expectSoonOn(page, '/faq', question);

      await page.goto('/admin/website');
      await page.getByRole('tab', { name: 'FAQ' }).click();
      await page.getByRole('button', { name: 'Delete' }).first().click();
      await page.getByRole('button', { name: 'Delete' }).last().click();
      await expect(page.getByText(question)).toBeHidden();

      // go back to the standard wording with the reset button
      await page.getByRole('tab', { name: 'Home' }).click();
      await page.getByRole('button', { name: 'Use the standard wording' }).first().click();
      await expect(page.getByText('Back to the standard wording.')).toBeVisible();
      await expect.poll(await homeHeadlineSoon(page), { timeout: 20_000 }).not.toBe(headline);
    } finally {
      // never leave test wording on the site, even when a step above failed
      await page.request.delete('/api/v1/admin/site/home', { data: {}, timeout: 15_000 });
      const faq = (await (await page.request.get('/api/v1/admin/faq')).json()) as {
        items: { id: string; question: string }[];
      };
      for (const item of faq.items.filter((i) => i.question.startsWith('Can I pay by bank?'))) {
        await page.request.delete(`/api/v1/admin/faq/${item.id}`, { data: {}, timeout: 15_000 });
      }
    }
  });

  test('teachers cannot open the website editor or the inbox', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/admin/website');
    await expect(page).toHaveURL(/\/teach/);
    await page.goto('/admin/messages');
    await expect(page).toHaveURL(/\/teach/);
  });
});

test.describe('contact inbox and announcements', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'the journey runs on one phone and one desktop size',
    );
  });

  test('a message sent from the contact page reaches the inbox and can be closed', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const message = `Please call me about the Arabic course ${Date.now()}`;
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('Sara Ali');
    await page.getByLabel('Phone number').fill('911223344');
    await page.getByLabel('Message', { exact: false }).first().fill(message);
    await page.waitForTimeout(3500); // forms sent instantly are treated as bots
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Thank you!')).toBeVisible();

    await signInAs(page, SEED.owner);
    await page.goto('/admin/messages');
    const card = page.locator('li', { hasText: message });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Message closed.')).toBeVisible();
    await page.getByRole('link', { name: 'Closed' }).click();
    await expect(page.locator('li', { hasText: message })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('admin posts a public announcement; a teacher posts to a course', async ({ page }) => {
    test.setTimeout(90_000);
    const title = `Holiday hours ${Date.now()}`;
    await signInAs(page, SEED.owner);
    await page.goto('/admin/announcements');
    await page.getByRole('button', { name: 'New announcement' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Message').fill('We close at noon on Friday.');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Announcement posted.')).toBeVisible();
    await expectSoonOn(page, '/news', title);

    await signOutAndIn(page, SEED.teacher);
    await page.goto('/teach/announcements');
    await page.getByRole('button', { name: 'New announcement' }).click();
    // Teachers can only post to a course: no audience choice
    await expect(page.getByText('Who sees it')).toBeHidden();
    const courseTitle = `Homework ${Date.now()}`;
    await page.getByLabel('Title').fill(courseTitle);
    await page.getByLabel('Message').fill('Please finish unit one.');
    await page.getByLabel('Course').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Announcement posted.')).toBeVisible();
    await expect(page.getByText(courseTitle)).toBeVisible();
    // and it does not show on the public news page
    await page.goto('/news');
    await expect(page.getByText(courseTitle)).toBeHidden();
  });
});

test.describe('new screens fit every phone', () => {
  test('admin pages', async ({ page }) => {
    await signInAs(page, SEED.owner);
    for (const path of ['/admin/website', '/admin/messages', '/admin/announcements']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    }
  });

  test('teacher announcements', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/teach/announcements');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });
});
