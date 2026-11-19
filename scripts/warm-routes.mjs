/**
 * Opens every main page once, so the development server compiles them now instead of the first time
 * you click. Run it in a second terminal after `pnpm dev` has started:
 *
 *   pnpm dev:warm            (the site at http://localhost:3000)
 *   pnpm dev:warm http://localhost:3100
 *
 * It signs in with the development accounts from `pnpm db:seed` (owner from apps/api/.env, plus the
 * sample teacher and student), so the signed-in pages compile too. Development only.
 */
import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

function readEnv() {
  try {
    const text = readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8');
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
    );
  } catch {
    return {};
  }
}
const env = readEnv();

const roles = [
  {
    name: 'visitor',
    account: null,
    routes: [
      '/',
      '/courses',
      '/about',
      '/news',
      '/contact',
      '/faq',
      '/privacy',
      '/terms',
      '/verify',
      '/find-your-level',
      '/teachers',
      '/sign-in',
      '/register',
      '/forgot-password',
      '/help',
      '/courses/everyday-english',
    ],
  },
  {
    name: 'student',
    account: { phone: '+251911000002', password: 'Student2026' },
    routes: [
      '/dashboard',
      '/my-courses',
      '/browse',
      '/browse/everyday-english',
      '/groups',
      '/guide',
      '/chat',
      '/announcements',
      '/profile',
      '/profile/payments',
      '/certificates',
      '/learn/everyday-english',
    ],
  },
  {
    name: 'teacher',
    account: { phone: '+251911000001', password: 'Teacher2026' },
    routes: [
      '/teach',
      '/teach/courses',
      '/teach/marking',
      '/teach/groups',
      '/teach/announcements',
      '/teach/chat',
      '/teach/guide',
    ],
    // Pages that need a real course or lesson: the first ones this teacher has.
    discover: async (get) => {
      const list = await get('/teach/courses?pageSize=1');
      const course = list?.items?.[0];
      if (!course) return [];
      const routes = [`/teach/courses/${course.id}`, `/teach/courses/${course.id}/students`];
      const outline = await get(`/teach/courses/${course.id}/outline`);
      const lesson = outline?.units?.flatMap((u) => u.lessons ?? [])?.[0];
      if (lesson) {
        routes.push(`/teach/courses/${course.id}/lessons/${lesson.id}`);
        routes.push(`/teach/courses/${course.id}/lessons/${lesson.id}/preview`);
      }
      return routes;
    },
  },
  {
    name: 'admin',
    account: env.SEED_OWNER_PHONE
      ? { phone: env.SEED_OWNER_PHONE, password: env.SEED_OWNER_PASSWORD }
      : null,
    routes: [
      '/admin',
      '/admin/users',
      '/admin/enrolments',
      '/admin/groups',
      '/admin/courses',
      '/admin/courses/new',
      '/admin/payments',
      '/admin/certificates',
      '/admin/announcements',
      '/admin/messages',
      '/admin/chat',
      '/admin/website',
      '/admin/reports',
      '/admin/activity',
      '/admin/settings',
      '/admin/settings/payments',
      '/admin/settings/sms',
      '/admin/settings/certificate',
      '/admin/settings/catalogue',
    ],
  },
];

async function signIn(account) {
  const res = await fetch(`${base}/api/v1/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!res.ok) return null;
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

let total = 0;
const started = Date.now();
for (const role of roles) {
  let cookie = '';
  if (role.account) {
    cookie = (await signIn(role.account)) ?? null;
    if (cookie === null) {
      console.log(`- ${role.name}: could not sign in, skipped (run "pnpm db:seed" first)`);
      continue;
    }
  }
  console.log(`\n${role.name}`);
  const routes = [...role.routes];
  if (role.discover) {
    const get = async (path) => {
      try {
        const res = await fetch(`${base}/api/v1${path}`, { headers: { cookie } });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    };
    routes.push(...(await role.discover(get).catch(() => [])));
  }
  for (const path of routes) {
    const t = Date.now();
    try {
      const res = await fetch(base + path, {
        headers: cookie ? { cookie } : {},
        redirect: 'follow',
      });
      await res.arrayBuffer();
      console.log(`  ${String(Date.now() - t).padStart(6)} ms  ${res.status}  ${path}`);
      total++;
    } catch (error) {
      console.log(`  failed  ${path}: ${error.message}`);
    }
  }
}
console.log(
  `\nWarmed ${total} pages in ${Math.round((Date.now() - started) / 1000)} s. Clicking around is quick now.`,
);
