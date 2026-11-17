import { expect, type Page, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  SEED,
  signInAs,
  waitForPageReady,
} from './helpers';

const ROLES = [
  { name: 'visitor', account: null, start: ['/', '/sign-in', '/register', '/styleguide'] },
  { name: 'student', account: SEED.student, start: ['/dashboard', '/profile'] },
  { name: 'teacher', account: SEED.teacher, start: ['/teach', '/profile'] },
  { name: 'admin', account: SEED.owner, start: ['/admin', '/admin/users', '/profile'] },
] as const;

/** Links that end the session or are not pages. */
const SKIP = (path: string) =>
  path.startsWith('/api') || path === '/sign-out' || path.includes('does-not-exist');

/**
 * Pages made from data (one per course, student, quiz…) share a shape. A few of each are enough to
 * prove the shape works, and it keeps the crawl the same size however much test data has piled up.
 */
const SAMPLES_PER_SHAPE = 2;
const shapeOf = (path: string) => path.replace(/\/c[a-z0-9]{20,}(?=\/|$)/g, '/:id');

async function crawl(page: Page, start: readonly string[], signedIn: boolean) {
  const seen = new Set<string>();
  const perShape = new Map<string, number>();
  const queue = [...start];
  const problems: string[] = [];

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    const shape = shapeOf(path);
    const count = perShape.get(shape) ?? 0;
    if (shape !== path && count >= SAMPLES_PER_SHAPE) continue;
    perShape.set(shape, count + 1);
    seen.add(path);

    const response = await page.goto(path);
    await waitForPageReady(page);
    // Redirects (a signed-in person opening /register) settle after the loader: give the title a moment.
    await page
      .getByRole('heading', { level: 1 })
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    if (response?.status() !== 200) problems.push(`${path} → HTTP ${response?.status()}`);
    if (await page.getByRole('heading', { name: 'Something went wrong' }).count()) {
      problems.push(`${path} → shows the error page`);
    }
    if (!(await page.getByRole('heading', { level: 1 }).count())) {
      problems.push(`${path} → no page title`);
    }
    // the guard must never bounce a signed-in person to the sign-in screen
    if (signedIn && page.url().includes('/sign-in') && !path.startsWith('/sign-in')) {
      problems.push(`${path} → sent to sign-in`);
    }

    const links = await page.$$eval('a[href^="/"]', (as) =>
      as.map((a) => (a.getAttribute('href') ?? '').split('#')[0]!.split('?')[0]!),
    );
    for (const link of links) if (link && !seen.has(link) && !SKIP(link)) queue.push(link);
  }
  return { seen, problems };
}

/**
 * Follows every internal link reachable from each area, so a menu item, footer link or button can
 * never lead to a 404 or an error page. Runs at every screen size (phone first).
 */
for (const role of ROLES) {
  test(`every link works for a ${role.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    if (role.account) await signInAs(page, role.account);
    const { seen, problems } = await crawl(page, role.start, role.account !== null);
    expect(problems, problems.join('\n')).toEqual([]);
    expect(seen.size).toBeGreaterThan(role.name === 'visitor' ? 12 : 4);
  });
}

test('placeholder pages fit the screen and are accessible', async ({ page }) => {
  for (const path of ['/courses', '/about', '/contact', '/privacy']) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  }
});

test('sign out ends the session and returns to the home page', async ({ page }) => {
  await signInAs(page, SEED.student);
  await page.goto('/dashboard');
  await page.goto('/sign-out');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/sign-in/);
});
