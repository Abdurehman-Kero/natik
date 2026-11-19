import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues } from './helpers';

/** The public website: what a first-time visitor sees, phone first. */
test.describe('home page', () => {
  test('tells visitors who Natik is and what to do next', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Learn Arabic, English & Afaan Oromo' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse courses' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find your level' }).first()).toBeVisible();

    for (const heading of [
      'Choose a language',
      'How it works',
      'Why Natik',
      'Learn week by week',
      'Questions? We have answers',
      'Ready to start?',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(page.getByText('Questions about payment?')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the hero is a real photograph with a clear promise and one main action', async ({
    page,
  }) => {
    await page.goto('/');
    const hero = page.locator('section').first();
    await expect(hero.getByRole('link', { name: 'Browse courses' })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'Find your level' })).toBeVisible();
    await expect(hero.getByText('Certificates you can verify')).toBeVisible();
    // the photo really loaded (not a broken image)
    await expect
      .poll(() =>
        hero
          .locator('img')
          .evaluateAll(
            (imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length,
          ),
      )
      .toBeGreaterThan(0);
    // on phones the headline and main button are visible without scrolling
    const button = await hero.getByRole('link', { name: 'Browse courses' }).boundingBox();
    const viewport = page.viewportSize();
    expect(button!.y + button!.height).toBeLessThan(viewport!.height);
  });

  test('language cards lead to that language', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /Arabic/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/courses\?language=ar/);
    await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
  });

  test('the FAQ on the home page opens and closes', async ({ page }) => {
    await page.goto('/');
    const question = page.getByRole('button', { name: 'How do I register?' });
    await question.scrollIntoViewIfNeeded();
    await question.click();
    await expect(
      page.getByText('Then ask to join a course and the Natik team accepts you.'),
    ).toBeVisible();
    await question.click();
    await expect(
      page.getByText('Then ask to join a course and the Natik team accepts you.'),
    ).toBeHidden();
  });

  test('the footer has links, policies and contact details', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const name of ['Courses', 'About', 'FAQ', 'Privacy notice', 'Terms of use']) {
      await expect(footer.getByRole('link', { name })).toBeVisible();
    }
    await expect(footer.getByRole('button', { name: 'Verify a certificate' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Take a tour' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact us' })).toBeVisible();
  });
});

test.describe('public pages', () => {
  const pages = [
    ['/about', 'About Natik'],
    ['/courses', 'Courses'],
    ['/news', 'News'],
    ['/contact', 'Contact us'],
    ['/faq', 'Frequently asked questions'],
    ['/help', 'Help centre'],
    ['/privacy', 'Privacy notice'],
    ['/terms', 'Terms of use'],
    ['/verify', 'Verify a certificate'],
  ] as const;

  for (const [path, title] of pages) {
    test(`${path} is complete, fits the screen and is accessible`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    });
  }

  test('privacy and terms are written in short numbered sections', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /What we collect/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cookies/ })).toBeVisible();
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /Your account/ })).toBeVisible();
  });

  test('FAQ answers the common questions', async ({ page }) => {
    await page.goto('/faq');
    for (const question of [
      'How do I pay for a course?',
      'Do I get a certificate?',
      'Can I study on my phone?',
    ]) {
      await expect(page.getByRole('button', { name: question })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Contact us' }).first()).toBeVisible();
  });
});

test.describe('courses', () => {
  test('course cards show real pictures', async ({ page }) => {
    await page.goto('/courses');
    const pictures = page.getByRole('listitem').locator('img');
    await expect(pictures.first()).toBeVisible();
    await expect
      .poll(() =>
        pictures.evaluateAll(
          (imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length,
        ),
      )
      .toBeGreaterThanOrEqual(3);
  });

  test('visitors can filter by language and level, and clear the filters', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByText(/\d+ courses?/).first()).toBeVisible();

    // The filters are a column on large screens and a drawer behind "Filters" on phones.
    async function tick(group: string, name: RegExp) {
      const drawerButton = page.getByRole('button', { name: /^Filters/ });
      const inDrawer = await drawerButton.isVisible();
      if (inDrawer) await drawerButton.click();
      const scope = inDrawer ? page.getByRole('dialog') : page.getByRole('complementary');
      await scope.getByRole('group', { name: group }).getByRole('checkbox', { name }).click();
      if (inDrawer) await page.getByRole('dialog').getByRole('button', { name: /^Show/ }).click();
    }

    await tick('Language', /Afaan Oromo/);
    await expect(page).toHaveURL(/language=om/);
    await expect(page.getByRole('link', { name: /Afaan Oromo Basics/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Arabic for Beginners/ })).toBeHidden();

    // a combination with no match explains itself and offers a way out (FR-CAT-006)
    await tick('Level', /Advanced/);
    await expect(page.getByRole('heading', { name: 'No courses match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.getByRole('link', { name: /Arabic for Beginners/ }).first()).toBeVisible();
  });

  test('typing in the course search narrows the list as you type', async ({ page }) => {
    await page.goto('/courses');
    const box = page.getByRole('searchbox', { name: 'Search courses…' });
    await box.fill('afaan');
    await expect(page.getByRole('link', { name: /Afaan Oromo Basics/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Arabic for Beginners/ })).toBeHidden();
    await box.fill('zzzz');
    await expect(page.getByRole('heading', { name: 'No courses match' })).toBeVisible();
  });

  test('a course page shows what you learn and an easy way to register', async ({ page }) => {
    await page.goto('/courses/arabic-for-beginners');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Arabic for Beginners' }),
    ).toBeVisible();
    // Premium courses show no amount: visitors are pointed to Natik support instead.
    await expect(page.getByText('Premium course').first()).toBeVisible();
    // (The related courses further down can be other courses with a public price.)
    await expect(page.getByRole('complementary')).not.toContainText('ETB');
    await expect(page.getByRole('link', { name: 'WhatsApp' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: "What you'll learn" })).toBeVisible();
    // Registering opens a dialog on the same page, so the visitor never loses their place.
    await page.getByRole('link', { name: 'Register to enrol' }).click();
    await expect(page.getByRole('dialog', { name: 'Create your free account' })).toBeVisible();
    await expect(page).toHaveURL(/\/courses\/arabic-for-beginners$/);
    await expectNoHorizontalScroll(page);
  });

  test('a course page is accessible and fits the screen', async ({ page }) => {
    await page.goto('/courses/everyday-english');
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('an unknown course shows the friendly not-found page', async ({ page }) => {
    const response = await page.goto('/courses/this-course-does-not-exist');
    // Pages stream in each visitor's language, so the status is sent before the page knows; Next.js
    // then marks the not-found page "noindex" so search engines drop it.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('contact and certificates', () => {
  test('the contact form checks input, then sends a message', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Enter your full name.')).toBeVisible();
    await expect(page.getByText('Please write a little more so we can help.')).toBeVisible();

    await page.getByLabel('Your name').fill('Sara Ali');
    await page.getByLabel('Phone number').fill('911223344');
    await page.getByLabel('Message').fill('Hello, I would like to know which level suits me.');
    await page.waitForTimeout(3200); // forms sent instantly are treated as bots
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('the contact page shows configured details and the form first on phones', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Reach us' })).toBeVisible();
    if (isMobile) {
      const form = await page.getByRole('heading', { name: 'Send a message' }).boundingBox();
      const details = await page.getByRole('heading', { name: 'Reach us' }).boundingBox();
      expect(form!.y).toBeLessThan(details!.y);
    }
  });

  test('an unknown certificate number says so in plain words', async ({ page }) => {
    await page.goto('/verify');
    await page.getByLabel('Certificate number').fill('NLC-2099-00000');
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: "We couldn't find this number" }),
    ).toBeVisible();
  });
});
