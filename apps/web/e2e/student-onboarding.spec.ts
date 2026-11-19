import path from 'node:path';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, newContact } from './helpers';

const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/student-onboarding');

/** A brand-new student on a phone: where to start, the menu, the tour; and the public phone tabs. */
test.describe('first steps on a phone', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!['mobile', 'phone-320'].includes(testInfo.project.name), 'phones only');
  });

  test('a new student is guided from scratch: steps, menu button and tour', async ({
    page,
  }, testInfo) => {
    const res = await page.request.post('/api/v1/auth/register', {
      data: {
        fullName: 'Amina Newcomer',
        ...newContact(),
        password: 'Passw0rd123',
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(res.status()).toBe(201);
    await page.goto('/dashboard');

    // Three plain steps and one big button, not an empty page.
    await expect(
      page.getByRole('heading', { level: 2, name: "Let's get you started" }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose a course' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore courses' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '1-getting-started.png'),
      animations: 'disabled',
    });

    // The menu button at the top left opens every page.
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog');
    await expect(menu.getByText('Amina Newcomer')).toBeVisible();
    await expect(menu.getByRole('link', { name: 'My payments' })).toBeVisible();
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '2-menu.png'),
      animations: 'disabled',
    });
    await menu.getByRole('button', { name: 'How this works' }).click();

    // The tour points at the menu button, then the tabs, and ends with a way to explore.
    const first = page.getByRole('dialog', { name: 'Welcome to your learning space' });
    await expect(first).toBeVisible();
    await first.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: 'Your menu' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '3-tour-menu.png'),
      animations: 'disabled',
    });
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog', { name: 'Ready to learn?' })).toBeVisible();
    await page.getByRole('link', { name: 'Explore courses' }).last().click();
    await expect(page).toHaveURL(/\/browse/);
  });

  test('public pages have four big tabs along the bottom on phones', async ({ page }, testInfo) => {
    await page.goto('/');
    const tabs = page.getByRole('navigation', { name: 'Quick navigation' });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: 'Courses' })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Search courses' })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await page.screenshot({
      path: path.join(SHOTS, testInfo.project.name, '4-public-tabs.png'),
      animations: 'disabled',
    });

    await tabs.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/courses/);
    await tabs.getByRole('button', { name: 'Search courses' }).click();
    await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await tabs.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible();
  });
});
