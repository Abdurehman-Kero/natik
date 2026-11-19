import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, SEED, signInAs } from './helpers';

/** Teachers and admins get labelled tabs along the bottom on phones, like students. */
test.describe('staff bottom tabs', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!['mobile', 'phone-320'].includes(testInfo.project.name), 'phones only');
  });

  test('teachers have five tabs: Home, Courses, Marking, Groups, Messages', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/teach');
    const tabs = page.getByRole('navigation', { name: 'Quick navigation' });
    await expect(tabs).toBeVisible();
    for (const name of ['Home', 'Courses', 'Marking', 'Groups', 'Messages']) {
      await expect(tabs.getByRole('link', { name })).toBeVisible();
    }
    await expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await tabs.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/teach\/courses/);
    await expect(tabs.getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The full menu is still one tap away.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Help' })).toBeVisible();
  });

  test('admins have Home, Enrolments, Courses, Payments and a More tab that opens the menu', async ({
    page,
  }) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin');
    const tabs = page.getByRole('navigation', { name: 'Quick navigation' });
    for (const name of ['Home', 'Enrolments', 'Courses', 'Payments']) {
      await expect(tabs.getByRole('link', { name })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await tabs.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/admin\/courses/);

    await tabs.getByRole('button', { name: 'More' }).click();
    const menu = page.getByRole('dialog');
    await expect(menu.getByRole('link', { name: 'Users' })).toBeVisible();
    await menu.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expectNoHorizontalScroll(page);
  });
});
