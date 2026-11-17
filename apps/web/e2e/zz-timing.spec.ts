import { test } from '@playwright/test';
import { SEED, signInAs } from './helpers';

const ROUTES: Record<string, string[]> = {
  visitor: [
    '/',
    '/courses',
    '/courses/everyday-english',
    '/free-lessons',
    '/help',
    '/about',
    '/teachers',
    '/faq',
    '/news',
  ],
  student: [
    '/dashboard',
    '/my-courses',
    '/browse',
    '/certificates',
    '/chat',
    '/announcements',
    '/profile',
    '/learn/everyday-english',
  ],
  teacher: ['/teach', '/teach/courses', '/teach/marking', '/teach/chat', '/teach/announcements'],
  admin: [
    '/admin',
    '/admin/users',
    '/admin/enrolments',
    '/admin/courses',
    '/admin/payments',
    '/admin/certificates',
    '/admin/messages',
    '/admin/website',
    '/admin/reports',
    '/admin/activity',
    '/admin/settings',
    '/admin/chat',
  ],
};

test('server time per page', async ({ page }) => {
  test.setTimeout(300_000);
  const lines: string[] = [];
  for (const [who, routes] of Object.entries(ROUTES)) {
    await page.context().clearCookies();
    if (who === 'student') await signInAs(page, SEED.student);
    if (who === 'teacher') await signInAs(page, SEED.teacher);
    if (who === 'admin') await signInAs(page, SEED.owner);
    for (const route of routes) {
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const res = await page.request.get(route, { headers: { RSC: '1' } });
        await res.body();
        times.push(Date.now() - t0);
      }
      times.sort((a, b) => a - b);
      lines.push(`${who.padEnd(8)} ${route.padEnd(30)} ${String(times[1]).padStart(5)} ms`);
    }
  }
  console.log(lines.join('\n'));
});
