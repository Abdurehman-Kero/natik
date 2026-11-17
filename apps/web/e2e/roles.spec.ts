import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  latestSms,
  newPhone,
  SEED,
  signInAs,
} from './helpers';

/** The student, teacher and admin areas: who gets in, how they look on phones, and user management. */
test.describe('areas and permissions', () => {
  test('the student area has four bottom tabs on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'bottom tabs are for phones');
    await signInAs(page, SEED.student);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Main navigation' }).last();
    for (const name of ['Home', 'Courses', 'Certificates', 'Profile']) {
      await expect(tabs.getByRole('link', { name })).toBeVisible();
    }
    await expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('students are kept out of staff areas without an error page', async ({ page }) => {
    await signInAs(page, SEED.student);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/teach');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('teachers reach their area and are kept out of the admin area', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/teach');
    await expect(page.getByRole('heading', { level: 1, name: /Hello/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/teach/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/teach/);
  });

  test('signed-in visitors see Dashboard in the public header', async ({ page, isMobile }) => {
    await signInAs(page, SEED.student);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeHidden();
    // /sign-in sends signed-in people home instead of showing the form again
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/dashboard/);
    void isMobile;
  });

  test('admin: create a teacher in a dialog, find them, disable and enable', async ({ page }) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    const phone = newPhone();
    const name = `Teacher ${phone.slice(-4)}`;
    await page.getByRole('button', { name: 'New user' }).click();
    const dialog = page.getByRole('dialog', { name: 'New user' });
    await expect(dialog).toBeVisible();

    // empty form → messages next to the fields
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(dialog.getByText('Enter your full name.')).toBeVisible();

    await dialog.getByLabel('Full name').fill(name);
    await dialog.getByLabel('Phone number').fill(phone);
    await dialog.getByRole('radio', { name: 'Teacher' }).click();
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(dialog).toBeHidden();

    // the new teacher was texted a link to set a password
    expect(await latestSms(page, phone)).toContain('Set your password');

    await page.getByRole('searchbox', { name: 'Search name or phone…' }).fill(name);
    await page.getByRole('searchbox', { name: 'Search name or phone…' }).press('Enter');
    await expect(page).toHaveURL(/q=Teacher/);
    await expect(
      page.locator('li:visible, tr:visible').filter({ hasText: name }).first(),
    ).toBeVisible();

    await page
      .getByRole('button', { name: `Actions for ${name}` })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Disable' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('can’t sign in until you enable');
    await confirm.getByRole('button', { name: 'Disable account' }).click();
    const row = page.locator('li:visible, tr:visible').filter({ hasText: name }).first();
    await expect(row.getByText('Disabled')).toBeVisible();

    await page
      .getByRole('button', { name: `Actions for ${name}` })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Enable' }).click();
    await expect(row.getByText('Active')).toBeVisible();
  });

  test('admin: the owner can create admins; searching with no match offers to clear', async ({
    page,
  }) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin/users?q=zzzznomatch');
    await expect(page.getByRole('heading', { name: 'No users found' })).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.getByRole('button', { name: 'New user' }).click();
    const dialog = page.getByRole('dialog', { name: 'New user' });
    await expect(dialog.getByRole('radio', { name: 'Admin' })).toBeEnabled();
  });
});
