import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, SEED, signInAs } from './helpers';

/** An admin who opens Marking (a teacher page) keeps the full admin menu. */
test('admin opens Marking and still sees the whole admin menu', async ({ page }, testInfo) => {
  await signInAs(page, SEED.owner);
  await page.goto('/teach/marking');
  await expect(page.getByRole('heading', { level: 1, name: 'Marking' })).toBeVisible();

  // The admin groups below "Learning" are still there (on smaller screens they are in the menu drawer).
  if (testInfo.project.name === 'desktop') {
    for (const name of ['Payments to check', 'Enrolments', 'Announcements', 'Settings']) {
      await expect(page.getByRole('navigation').getByRole('link', { name }).first()).toBeVisible();
    }
  }
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11yIssues(page);
});
