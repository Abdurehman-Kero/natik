import { expect, test } from '@playwright/test';
import { SEED, signInAs } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let createdName: string | null = null;

/** The quote this test adds is removed again, so the demonstration site keeps only real-looking quotes. */
test.afterEach(async ({ page }) => {
  if (!createdName) return;
  await page.context().clearCookies();
  await page.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
  const list = (await (await page.request.get('/api/v1/admin/testimonials')).json()) as {
    items: { id: string; name: string }[];
  };
  for (const item of list.items.filter((t) => t.name === createdName)) {
    await page.request.delete(`/api/v1/admin/testimonials/${item.id}`);
  }
  createdName = null;
});

/** An admin adds a student quote with a photo; it shows on the home page with that picture. */
test('an admin can upload a photo for a testimonial, and visitors see it', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one size is enough for this admin screen');
  const name = `Photo Student ${Date.now()}`;
  createdName = name;
  await signInAs(page, SEED.owner);
  await page.goto('/admin/website');
  await page.getByRole('tab', { name: 'Testimonials' }).click();
  await page.getByRole('button', { name: 'Add a quote' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel("Student's name").fill(name);
  await dialog.getByLabel('What they said').fill('I could ask my questions at any time and learn.');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'student.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  // The picture appears in the form before saving.
  await expect(dialog.locator('img').first()).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const row = page.getByRole('listitem').filter({ hasText: name });
  await expect(row.locator('img')).toBeVisible({ timeout: 15_000 });

  // Visitors see the same picture next to the quote once the slide shows it.
  await page.context().clearCookies();
  await page.goto('/');
  const region = page.getByRole('region', { name: 'What our students say' });
  await region.scrollIntoViewIfNeeded();
  const next = region.getByRole('button', { name: 'Next quote' });
  for (let i = 0; i < 12; i++) {
    if ((await region.getByText(name).count()) > 0) break;
    await next.click();
  }
  await expect(region.getByText(name)).toBeVisible();
  await expect
    .poll(() =>
      region
        .locator('img')
        .evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length),
    )
    .toBeGreaterThan(0);
});
