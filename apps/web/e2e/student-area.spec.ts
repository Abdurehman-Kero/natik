import { expect, type Page, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, newPhone } from './helpers';

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function registerStudent(page: Page) {
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: `Area Student ${unique()}`,
      phone: newPhone(),
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** The student area: browsing courses without leaving it, the menu order and signing out. */
test.describe('student area', () => {
  test('Browse courses shows the courses inside the dashboard, and a course opens there too', async ({
    page,
  }) => {
    await registerStudent(page);
    await page.goto('/dashboard');
    await page.goto('/browse');
    await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
    // Still the student area: no public header, the student's own top bar is there.
    await expect(page.getByRole('link', { name: 'Register' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Everyday English/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // Filtering stays on the same page.
    await page.getByLabel('Language', { exact: true }).selectOption({ label: 'English' });
    await expect(page).toHaveURL(/\/browse\?language=en/);

    await page
      .getByRole('link', { name: /Everyday English/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/browse\/everyday-english$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Everyday English' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enrol free' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Register' })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the menu ends with Certificates, and Sign out sits at the bottom of the sidebar', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['desktop', 'tablet'].includes(testInfo.project.name),
      'the sidebar is for large screens',
    );
    test.skip(testInfo.project.name === 'tablet', 'the sidebar shows from 1024 px');
    await registerStudent(page);
    await page.goto('/dashboard');
    const menu = page.getByRole('complementary').getByRole('navigation');
    await expect(menu.getByRole('link', { name: 'Certificates' })).toBeVisible();
    const labels = await menu.getByRole('link').allInnerTexts();
    const names = labels.map((l) => l.trim().split('\n')[0]);
    expect(names.at(-1)).toBe('Certificates');
    expect(names).toContain('Browse courses');
    await menu.getByRole('link', { name: 'Browse courses' }).click();
    await expect(page).toHaveURL(/\/browse$/);

    await page.getByRole('complementary').getByRole('link', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
