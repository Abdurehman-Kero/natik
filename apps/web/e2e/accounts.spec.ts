import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  latestCode,
  latestSms,
  newPhone,
  typeCode,
} from './helpers';

/**
 * AT-02 and AT-03 through the real screens, on phones first: register, SMS code, sign in,
 * lockout, password reset, profile and sign-out.
 */
test.describe('accounts', () => {
  async function register(page: import('@playwright/test').Page, phone: string, password: string) {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Abdi Kedir');
    await page.getByLabel('Phone number').fill(phone);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('checkbox', { name: /16 or older/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }

  test('a new student registers with name, phone and password and lands on the dashboard', async ({
    page,
  }) => {
    const phone = newPhone();
    await register(page, phone, 'Passw0rd123');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    // nothing to verify, and no SMS was sent
    await expect(page.getByText('Verify your phone')).toBeHidden();
    const res = await page.request.get(`/api/v1/dev/sms?to=${encodeURIComponent('+251' + phone)}`);
    expect((await res.json()).items).toHaveLength(0);
  });

  test('forms explain mistakes next to the field', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your full name.')).toBeVisible();
    await expect(page.getByText('Enter a 9-digit Ethiopian mobile number.')).toBeVisible();
    await expect(page.getByText('Please accept to continue.')).toBeVisible();
  });

  test('a phone that already has an account offers sign in and reset', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Someone Else');
    await page.getByLabel('Phone number').fill('911000002'); // seeded student
    await page.getByLabel('Password', { exact: true }).fill('Passw0rd123');
    await page.getByRole('checkbox', { name: /16 or older/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This number already has an account.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reset password' })).toBeVisible();
  });

  test('sign in: wrong password gives one plain message, the right one opens the dashboard', async ({
    page,
  }) => {
    const phone = newPhone();
    await register(page, phone, 'Passw0rd123');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/sign-out');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/sign-in');
    await page.getByLabel('Phone number').fill(phone);
    await page.getByLabel('Password', { exact: true }).fill('Wrong12345');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Phone number or password is incorrect.' }),
    ).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill('Passw0rd123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('protected pages send visitors to sign in, then bring them back', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
    await page.getByLabel('Phone number').fill('911000002');
    await page.getByLabel('Password', { exact: true }).fill('Student2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('forgot password: phone, code, new password, then sign in', async ({ page }) => {
    const phone = newPhone();
    await register(page, phone, 'Passw0rd123');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/sign-out');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/forgot-password');
    await page.getByLabel('Phone number').fill(phone);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // the reset code is the newest message
    await expect.poll(async () => (await latestSms(page, phone)).includes('reset')).toBe(true);
    await typeCode(page, await latestCode(page, phone));
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel('New password').fill('NewPassw0rd9');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('heading', { name: 'Password saved' })).toBeVisible();

    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.getByLabel('Phone number').fill(phone);
    await page.getByLabel('Password', { exact: true }).fill('NewPassw0rd9');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('profile: edit details and change password in dialogs, then sign out', async ({ page }) => {
    const phone = newPhone();
    await register(page, phone, 'Passw0rd123');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await page.getByRole('button', { name: 'Edit details' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit your details' });
    await edit.getByLabel('Full name').fill('Abdi K. Kedir');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Abdi K. Kedir' })).toBeVisible();

    await page.getByRole('button', { name: 'Change password' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change your password' });
    await dialog.getByLabel('Current password').fill('Nope12345');
    await dialog.getByLabel('New password').fill('NewPassw0rd9');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText('Your current password is incorrect.')).toBeVisible();
    await dialog.getByLabel('Current password').fill('Passw0rd123');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    await page.locator('#main').getByRole('link', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });

  test('set-password link: an invalid link explains what to do', async ({ page }) => {
    await page.goto('/set-password?token=' + 'x'.repeat(43));
    await page.getByLabel('New password').fill('NewPassw0rd9');
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reset password' })).toBeVisible();
  });
});
