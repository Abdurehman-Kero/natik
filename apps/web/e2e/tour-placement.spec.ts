import path from 'node:path';
import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { newContact } from './helpers';

const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/tour-placement');

const TARGETS: Record<string, string[]> = {
  'Your menu': ['[data-tour="student-menu"]', '[data-tour="student-nav"]'],
  'Quick tabs': ['[data-tour="student-tabs"]'],
  'News from your teachers': ['[data-tour="student-bell"]'],
  'Your account': ['[data-tour="student-account"]'],
};

/** The first element for these selectors that is really on screen. */
async function visibleBox(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    for (const element of await page.locator(selector).all()) {
      const box = await element.boundingBox();
      if (box && box.width > 0 && box.height > 0) return box;
    }
  }
  return null;
}

/**
 * The tour card must always be fully on screen with its buttons reachable, and must not cover the part
 * of the page it points at. (On large screens step 2 points at the whole side menu, which is as tall as the
 * screen: the card used to be placed below it, off screen, leaving only a dimmed page.)
 */
async function walkTour(page: Page, testInfo: TestInfo) {
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: 'Tour Shot Student',
      ...newContact(),
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status()).toBe(201);
  await page.goto('/dashboard');

  // Start the tour from the account menu on large screens, from the menu sheet on phones.
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  if (phone) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'How this works' }).click();
  } else {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'How this works' }).click();
  }

  const viewport = page.viewportSize()!;
  const card = page.locator('[role="dialog"][aria-labelledby="tour-title"]');
  await expect(card).toBeVisible();

  const seen: string[] = [];
  for (let step = 0; step < 8; step++) {
    // Let the card settle (it measures itself and may move once).
    await page.waitForTimeout(450);
    const title = (await card.locator('#tour-title').innerText()).trim();
    seen.push(title);

    const box = (await card.boundingBox())!;
    expect(box.x, `${title}: left edge`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${title}: top edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${title}: right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height, `${title}: bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5);

    // The way forward is always visible and inside the window.
    const forward = card
      .getByRole('button', { name: /^(Next|Finish)/ })
      .or(card.getByRole('link', { name: 'Explore courses' }));
    await expect(forward.first()).toBeVisible();
    const forwardBox = (await forward.first().boundingBox())!;
    expect(forwardBox.y + forwardBox.height, `${title}: button inside window`).toBeLessThanOrEqual(
      viewport.height + 0.5,
    );

    // It does not sit on top of the part it points at.
    const targets = TARGETS[title];
    if (targets) {
      const target = await visibleBox(page, targets);
      expect(target, `${title}: something to point at`).not.toBeNull();
      const overlaps =
        box.x < target!.x + target!.width &&
        box.x + box.width > target!.x &&
        box.y < target!.y + target!.height &&
        box.y + box.height > target!.y;
      expect(overlaps, `${title}: the card covers what it points at`).toBe(false);
    }

    await page.screenshot({
      path: path.join(
        SHOTS,
        testInfo.project.name,
        `${seen.length}-${title.replace(/\W+/g, '-')}.png`,
      ),
      animations: 'disabled',
    });
    if (await card.getByRole('link', { name: 'Explore courses' }).isVisible()) break;
    await card.getByRole('button', { name: 'Next' }).click();
  }

  // Large screens go through the side menu step, which is the one that used to disappear.
  expect(seen[1]).toBe('Your menu');
  expect(seen.at(-1)).toBe('Ready to learn?');
}

test('the student tour card is fully on screen and clear of what it points at, on every screen size', async ({
  page,
}, testInfo) => {
  await walkTour(page, testInfo);
});

// A big monitor, like the one where the side menu step first showed only a dimmed page.
test.describe('on a large monitor', () => {
  test.use({ viewport: { width: 1920, height: 1000 } });
  test('the tour card is beside the side menu, with its text and buttons', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one large-monitor run is enough');
    await walkTour(page, testInfo);
  });
});
