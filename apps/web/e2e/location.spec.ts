import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  SEED,
  signInAs,
  emailFor,
} from './helpers';

/** Where people are: asked at registration, kept, shown on their profile and to admins. */
test.describe('location', () => {
  test('the register page asks for gender, country and city, and keeps them', async ({ page }) => {
    const phone = newPhone();
    const last = `Place ${Date.now().toString(36)}`;
    await page.goto('/register');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeVisible();
    await expect(page.getByRole('group', { name: 'Personal information' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Account information' })).toBeVisible();
    // Ethiopia is chosen already.
    await expect(page.getByLabel('Country')).toHaveValue('ET');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await page.getByLabel('First name').fill('Meron');
    await page.getByLabel('Last name').fill(last);
    await page.getByLabel('Gender').selectOption('FEMALE');
    await page.getByLabel('Country').selectOption('KE');
    await page.getByLabel('City or town').fill('Nairobi');
    await page.getByLabel('Phone number').fill(phone);
    await page.getByLabel('Email').fill(emailFor(phone));
    await page.getByLabel('Password', { exact: true }).fill('Passw0rd123');
    await page.getByLabel('Confirm password').fill('Different123');
    await page.getByRole('checkbox', { name: /16 or older/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('The two passwords are not the same.')).toBeVisible();
    await page.getByLabel('Confirm password').fill('Passw0rd123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // The profile shows it, and the person can change it.
    await page.goto('/profile');
    await expect(page.getByText('Nairobi')).toBeVisible();
    await expect(page.getByText(/Kenya/)).toBeVisible();

    // An admin sees it in the users list and in the person's details.
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);
    await page.goto(`/admin/users?q=${encodeURIComponent(last)}`);
    // A table row on large screens, a card in a list on phones.
    const rowOf = () =>
      page.locator('tr, li').filter({ hasText: last }).filter({ visible: true }).last();
    const row = rowOf();
    await expect(row.getByText(/Kenya/)).toBeVisible();
    await expect(row.getByText('Nairobi')).toBeVisible();
    await row
      .getByRole('button', { name: new RegExp(last) })
      .first()
      .click();
    const details = page.getByRole('dialog', { name: new RegExp(last) });
    await expect(details.getByText('Location')).toBeVisible();
    await expect(details.getByText(/Kenya · Nairobi/)).toBeVisible();
    await expect(details.getByText('Female')).toBeVisible();

    // And filter by country.
    await page.goto('/admin/users?country=KE');
    await expect(rowOf()).toBeVisible();
    await page.goto('/admin/users?country=DJ');
    await expect(page.getByText(last)).toHaveCount(0);
  });
});
