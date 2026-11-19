import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  createStudent,
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  waitForHydration,
} from './helpers';

const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/public-site');

/** The public site as one flow: dialogs instead of page changes, a search, and a first-time tour. */
test.describe('public site flow', () => {
  async function ready(page: Page) {
    await expect(page.getByRole('banner')).toBeVisible();
    await waitForHydration(page.getByRole('banner'));
  }

  /** The header's search button is also in the phone menu, where the smallest phones have no room for it. */
  async function openSearch(page: Page) {
    const direct = page.getByRole('button', { name: 'Search courses' }).first();
    if (await direct.isVisible()) {
      await direct.click();
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('button', { name: 'Search courses' }).click();
    }
  }

  test('search finds a course from any page and opens it', async ({ page }, testInfo) => {
    await page.goto('/about');
    await ready(page);
    await openSearch(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: 'Search courses' })).toBeFocused();
    // Typing narrows the list the normal way: only matching courses stay.
    await dialog.getByRole('combobox').fill('arab');
    await expect(dialog.getByRole('option', { name: /Arabic for Beginners/ }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByRole('option', { name: /Everyday English/ })).toHaveCount(0);
    await dialog.getByRole('combobox').fill('everyday');
    await expect(dialog.getByRole('option', { name: /Everyday English/ })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousA11yIssues(page);
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '1-search.png'),
      animations: 'disabled',
    });
    await dialog.getByRole('option', { name: /Everyday English/ }).click();
    await expect(page).toHaveURL(/\/courses\/everyday-english$/);
    await expect(dialog).toBeHidden();

    await page.goto('/courses');
    await ready(page);
    await openSearch(page);
    await page.getByRole('dialog').getByRole('combobox').fill('zzzz-nothing');
    await expect(page.getByText(/No course matches/)).toBeVisible();
  });

  test('sign in and register open as a dialog and keep you on the page you were on', async ({
    page,
    baseURL,
  }, testInfo) => {
    const student = await createStudent(baseURL!);
    await page.goto('/courses/everyday-english');
    await ready(page);
    await page.getByRole('link', { name: 'Register to enrol' }).click({ timeout: 15_000 });
    const dialog = page.getByRole('dialog', { name: 'Create your free account' });
    await expect(dialog).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '2-register-dialog.png'),
      animations: 'disabled',
    });

    // Switch to sign-in inside the dialog, then sign in with a student made just for this test.
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
    await page.getByLabel('Email').fill(student.email);
    await page.getByLabel('Password', { exact: true }).fill(student.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

    // Still on the course page, now signed in: the button became a next step.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/courses\/everyday-english$/);
    await expect(page.getByRole('link', { name: 'Register to enrol' })).toBeHidden();
  });

  test('"Message the team" is a dialog and the message arrives', async ({ page }) => {
    await page.goto('/faq');
    await ready(page);
    await page.getByRole('button', { name: 'Contact us' }).click();
    const dialog = page.getByRole('dialog', { name: 'Message the team' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Your name').fill('Flow Tester');
    await dialog.getByLabel('Phone number').fill(newPhone());
    await dialog.getByLabel('Message').fill('Hello, which level suits me best?');
    await page.waitForTimeout(3200); // forms sent instantly are treated as bots
    await dialog.getByRole('button', { name: 'Send message' }).click();
    await expect(dialog.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  });

  test('"Find your level" opens as a dialog from the home page', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Find your level' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Find your level' });
    await expect(dialog.getByRole('button', { name: 'English' })).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
  });

  test('the tour can be started from the menu, walked through and left', async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.goto('/');
    await ready(page);
    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('button', { name: 'Take a tour' }).click();
    } else {
      await page.getByRole('button', { name: 'Help' }).click();
      await page.getByRole('menuitem', { name: 'Take a tour' }).click();
    }
    const tour = page.getByRole('dialog', { name: 'Welcome to Natik' });
    await expect(tour).toBeVisible();
    await expect(tour.getByText(/^Step 1 of \d/)).toBeVisible();
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '3-tour-welcome.png'),
      animations: 'disabled',
    });
    await tour.getByRole('button', { name: 'Next' }).click();
    const second = page.getByRole('dialog', { name: 'Find your course' });
    await expect(second).toBeVisible();
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '4-tour-step.png'),
      animations: 'disabled',
    });
    await expectNoHorizontalScroll(page);
    // Walk to the end with the keyboard.
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog', { name: 'How learning works' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create free account' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'How learning works' })).toBeHidden();
    // Leaving the tour does not break the page: the menu still works.
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('a first-time visitor is offered the tour once, quietly', async ({ browser, baseURL }) => {
    // Automated browsers are never offered it, so pretend to be an ordinary one.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.goto('/');
    await ready(page);
    const offer = page.getByRole('region', { name: 'New to Natik?' });
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await offer.getByRole('button', { name: 'No thanks' }).click();
    await expect(offer).toBeHidden();
    await page.reload();
    await ready(page);
    await page.waitForTimeout(4500);
    await expect(offer).toBeHidden();
    await context.close();
  });

  test('on a phone, a "Join this course" bar follows you down a course page', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the bar is for phones');
    await page.goto('/courses/everyday-english');
    await ready(page);
    const bar = page.getByRole('button', { name: 'Join this course' });
    await expect(bar).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('the language button is visible on every screen and changes the whole navigation', async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page);
    const language = page.getByRole('button', { name: /^Language: English/ });
    await expect(language).toBeVisible();
    await language.click();
    await page.getByRole('menuitem', { name: 'Afaan Oromoo' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'om', { timeout: 15_000 });
    // The menus, buttons and bottom tabs are all in Afaan Oromoo, not just the page.
    const bar = page.getByRole('navigation', { name: 'Daandii saffisaa' });
    const header = page.getByRole('banner');
    if (await bar.isVisible()) {
      await expect(bar.getByRole('link', { name: 'Koorsoota' })).toBeVisible();
    } else {
      await expect(header.getByRole('link', { name: 'Koorsoota' })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await page.context().clearCookies();
  });
});
