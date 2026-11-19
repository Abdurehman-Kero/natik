import { expect, test } from '@playwright/test';
import {
  createStudent,
  emailFor,
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  waitForHydration,
} from './helpers';

/**
 * "Continue with Google" through the real screens. The test servers run with GOOGLE_CLIENT_ID=dev, which
 * plays Google: the `login_hint` in the address is the email that "signs in" (see playwright.config.ts).
 */
test.describe('Google sign-in', () => {
  // A real Google (or a site without it) cannot be driven by a test.
  test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the fake Google of the local test servers');

  const googleEmail = () => emailFor(newPhone());

  test('the sign-in and register pages offer the button', async ({ page }) => {
    for (const path of ['/sign-in', '/register']) {
      await page.goto(path);
      const button = page.getByRole('link', { name: 'Continue with Google' });
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('href', /\/api\/v1\/auth\/google\/start/);
    }
    await expectNoHorizontalScroll(page);
  });

  test('a new person confirms the terms, lands on the dashboard, and next time goes straight in', async ({
    page,
    browser,
    baseURL,
  }) => {
    const email = googleEmail();
    await page.goto(`/api/v1/auth/google/start?login_hint=${encodeURIComponent(email)}`);
    await expect(page).toHaveURL(/\/register\/google/);
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await waitForHydration(page.locator('form'));
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // The promises are asked for, like in normal registration.
    await page.getByLabel('Full name').fill('E2E Google Student');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Please accept to continue.')).toBeVisible();
    await page.getByRole('checkbox', { name: /16 or older/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Their Profile says Google is connected and offers to set a password by email.
    await page.goto('/profile');
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Set a password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change password' })).toBeHidden();

    // A new browser, Google again: straight to the dashboard.
    const again = await browser.newContext();
    const second = await again.newPage();
    await second.goto(
      `${baseURL}/api/v1/auth/google/start?login_hint=${encodeURIComponent(email)}`,
    );
    await expect(second).toHaveURL(/\/dashboard/);
    await again.close();
  });

  test('an email that already has an account with a password signs straight in with Google', async ({
    page,
    baseURL,
  }) => {
    const student = await createStudent(baseURL!);
    await page.goto(`/api/v1/auth/google/start?login_hint=${encodeURIComponent(student.email)}`);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/profile');
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    // Their password is untouched, so "Change password" is still there.
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible();
  });

  test('a Google email that Google has not verified is refused', async ({ page }) => {
    await page.goto('/api/v1/auth/google/start?login_hint=unverified.person@example.com');
    await expect(page).toHaveURL(/\/sign-in\?google=unverified/);
    await expect(page.getByText('has not verified that email address')).toBeVisible();
  });

  test('the finishing page explains when the sign-up has expired', async ({ page }) => {
    await page.goto('/register/google');
    await expect(page.getByText('took too long and has expired')).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
