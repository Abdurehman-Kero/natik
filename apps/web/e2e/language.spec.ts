import { expect, type Page, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, waitForPageReady } from './helpers';

/** The website's menus and buttons in English, Amharic, Afaan Oromo and Somali. */
const LANGUAGES = [
  { code: 'am', name: 'አማርኛ', heading: 'ዐረብኛ፣ እንግሊዝኛ እና አፋን ኦሮሞ ይማሩ', courses: 'ኮርሶች' },
  {
    code: 'om',
    name: 'Afaan Oromoo',
    heading: 'Afaan Arabaa, Ingiliffaa fi Afaan Oromoo baradhu',
    courses: 'Koorsoota',
  },
  {
    code: 'so',
    name: 'Soomaali',
    heading: 'Baro Carabi, Ingiriisi iyo Afaan Oromo',
    courses: 'Koorsooyin',
  },
] as const;

/** On phones the language list is inside the menu; on larger screens it is a globe in the header. */
async function chooseLanguage(page: Page, name: string) {
  await waitForPageReady(page);
  const wide = (page.viewportSize()?.width ?? 0) >= 640;
  // Retried until the page has finished loading and the menu really opens.
  await expect(async () => {
    if (wide) {
      await page.getByRole('banner').getByRole('button', { name: /:/ }).click();
      await expect(page.getByRole('menuitem', { name })).toBeVisible({ timeout: 1000 });
    } else {
      await page.getByRole('banner').getByRole('button').last().click();
      await expect(page.getByRole('dialog').getByRole('button', { name })).toBeVisible({
        timeout: 1000,
      });
    }
  }).toPass({ timeout: 15_000 });
  if (wide) await page.getByRole('menuitem', { name }).click();
  else await page.getByRole('dialog').getByRole('button', { name }).click();
}

test.describe('interface languages', () => {
  for (const lang of LANGUAGES) {
    test(`the home page can be read in ${lang.name}`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: /Learn Arabic/ })).toBeVisible();
      await chooseLanguage(page, lang.name);
      await expect(page.getByRole('heading', { level: 1, name: lang.heading })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);
      await expectNoHorizontalScroll(page);
      await expectNoSeriousA11yIssues(page);
    });
  }

  test('the choice is remembered on other pages and after a reload', async ({ page }) => {
    await page.goto('/');
    await chooseLanguage(page, 'Soomaali');
    await expect(page.locator('html')).toHaveAttribute('lang', 'so', { timeout: 15_000 });
    await page.goto('/help');
    await waitForPageReady(page);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Xarunta caawimaadda' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'so');
    await expectNoHorizontalScroll(page);
  });

  test('every public page still opens and fits the screen in each language', async ({ page }) => {
    for (const lang of LANGUAGES) {
      await page.context().addCookies([
        {
          name: 'NEXT_LOCALE',
          value: lang.code,
          url: page.url() === 'about:blank' ? 'http://localhost:3100' : page.url(),
        },
      ]);
      for (const path of ['/', '/courses', '/help', '/free-lessons', '/find-your-level', '/faq']) {
        const response = await page.goto(path);
        expect(response?.status(), `${lang.code} ${path}`).toBeLessThan(400);
        await waitForPageReady(page);
        await expectNoHorizontalScroll(page);
      }
    }
  });

  test('the footer lets visitors switch back to English', async ({ page }) => {
    await page.goto('/');
    await chooseLanguage(page, 'አማርኛ');
    await expect(page.locator('html')).toHaveAttribute('lang', 'am', { timeout: 15_000 });
    const footer = page.getByRole('contentinfo');
    await footer.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Learn Arabic/ })).toBeVisible();
  });
});
