import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues } from './helpers';

const SHELLS = [
  { path: '/', heading: 'Learn Arabic, English & Afaan Oromo' },
  { path: '/sign-in', heading: 'Welcome back' },
  { path: '/register', heading: 'Create your account' },
  { path: '/forgot-password', heading: 'Reset password' },
  { path: '/courses', heading: 'Courses' },
];

test.describe('public pages', () => {
  for (const shell of SHELLS) {
    test(`${shell.path} renders, is accessible and fits the screen`, async ({ page }) => {
      await page.goto(shell.path);
      await expect(page.getByRole('heading', { level: 1, name: shell.heading })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    });
  }

  test('public phone menu opens and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the menu button is for small screens');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: 'Courses' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('errors and navigation aids', () => {
  test('unknown pages show a friendly 404 with a way home', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Go home' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });

  test('keyboard users can skip straight to the content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard check runs on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('search engines are kept away from non-production sites', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(await res.text()).toContain('Disallow: /');
  });
});

test.describe('styleguide', () => {
  test('renders every section without serious accessibility issues', async ({ page }) => {
    await page.goto('/styleguide');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Natik design system' }),
    ).toBeVisible();
    for (const name of [
      'Colours',
      'Buttons',
      'Inputs',
      'Status',
      'Cards',
      'Overlays',
      'Data',
      'Layouts',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('confirm dialog requires a reason before rejecting', async ({ page }) => {
    await page.goto('/styleguide#overlays');
    await page.getByRole('button', { name: 'Reject payment (needs reason)' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Reject payment' }).click();
    await expect(dialog.getByText('Please give a reason.')).toBeVisible();
    await dialog.getByLabel('Reason').fill('Reference not found');
    await dialog.getByRole('button', { name: 'Reject payment' }).click();
    await expect(dialog).toBeHidden();
  });

  test('OTP boxes accept a pasted code', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'clipboard permissions are desktop-only in Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/styleguide#inputs');
    await page.evaluate(() => navigator.clipboard.writeText('123456'));
    await page.getByRole('textbox', { name: 'Digit 1 of 6' }).focus();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.getByText('Complete: 123456')).toBeVisible();
  });

  test('phone field formats Ethiopian numbers as you type', async ({ page }) => {
    await page.goto('/styleguide#inputs');
    const phone = page.getByRole('textbox', { name: 'Phone number' }).first();
    await phone.fill('0912345678');
    await expect(phone).toHaveValue('091 234 5678');
    await phone.fill('+251912345678');
    await expect(phone).toHaveValue('91 234 5678');
  });
});
