'use client';

import { BookOpen, House, LayoutDashboard, LogIn, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAuthDialog } from '@/components/auth/auth-dialog';
import { useSiteTools } from '@/components/public/site-tools';
import Link from '@/components/ui/link';
import { HOME_FOR_ROLE } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/use-session';

const tabClass = (active: boolean) =>
  cn(
    'relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-center text-[0.6875rem] leading-tight font-semibold transition-colors',
    active ? 'text-primary' : 'text-muted hover:text-primary',
    'before:absolute before:top-0 before:h-[3px] before:w-8 before:rounded-full',
    active ? 'before:bg-accent' : 'before:bg-transparent',
  );

function Pill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
        active && 'bg-primary-soft',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Phones only: four big tabs along the bottom of every public page (Home, Courses, Search and
 * Sign in or Dashboard), within reach of a thumb. The menu button at the top still has everything else.
 */
export function PublicBottomBar() {
  const t = useTranslations('nav');
  const ts = useTranslations('site');
  const pathname = usePathname();
  const tools = useSiteTools();
  const auth = useAuthDialog();
  const { user } = useSession();
  const dashboard = user ? HOME_FOR_ROLE[user.role] : null;

  return (
    <nav
      aria-label={ts('bottom.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(18_59_90/0.06)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        <li>
          <Link
            prefetch
            href="/"
            aria-current={pathname === '/' ? 'page' : undefined}
            className={tabClass(pathname === '/')}
          >
            <Pill active={pathname === '/'}>
              <House className="size-6" aria-hidden />
            </Pill>
            {ts('nav.home')}
          </Link>
        </li>
        <li>
          <Link
            prefetch
            href="/courses"
            aria-current={pathname.startsWith('/courses') ? 'page' : undefined}
            className={tabClass(pathname.startsWith('/courses'))}
          >
            <Pill active={pathname.startsWith('/courses')}>
              <BookOpen className="size-6" aria-hidden />
            </Pill>
            {ts('nav.courses')}
          </Link>
        </li>
        <li>
          <button
            type="button"
            aria-label={ts('header.searchLabel')}
            onClick={() => tools.open('search')}
            className={tabClass(false)}
          >
            <Pill active={false}>
              <Search className="size-6" aria-hidden />
            </Pill>
            {ts('header.search')}
          </button>
        </li>
        <li>
          {dashboard ? (
            <Link prefetch href={dashboard} data-tour="account" className={tabClass(false)}>
              <Pill active={false}>
                <LayoutDashboard className="size-6" aria-hidden />
              </Pill>
              {t('public.dashboard')}
            </Link>
          ) : (
            <button
              type="button"
              data-tour="account"
              onClick={() => auth.open('sign-in')}
              className={tabClass(false)}
            >
              <Pill active={false}>
                <LogIn className="size-6" aria-hidden />
              </Pill>
              {ts('header.signIn')}
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}
