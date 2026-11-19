'use client';

import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { isActive, studentPhoneTabs } from './nav';
import type { BadgeCounts } from './sidebar';

/**
 * Student phone navigation: five labelled tabs within thumb reach (DESIGN.md §8), with a number on
 * Groups and Messages when something is waiting. The rest of the pages are in the menu button at
 * the top left.
 */
export function BottomTabs({
  className,
  badges = {},
}: {
  className?: string;
  badges?: BadgeCounts;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('mainNavigation')}
      data-tour="student-tabs"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(18_59_90/0.06)] backdrop-blur-md',
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {studentPhoneTabs.map((tab) => {
          const active = isActive(pathname, { href: tab.href, exact: tab.href === '/dashboard' });
          const count = tab.badge ? (badges[tab.badge] ?? 0) : 0;
          return (
            <li key={tab.href}>
              <Link
                prefetch
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-center text-[0.6875rem] leading-tight font-semibold transition-colors',
                  active ? 'text-primary' : 'text-muted hover:text-primary',
                  'before:absolute before:top-0 before:h-[3px] before:w-8 before:rounded-full',
                  active ? 'before:bg-accent' : 'before:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-primary-soft',
                  )}
                >
                  <tab.icon className="size-6" aria-hidden />
                  {count > 0 ? (
                    <span className="absolute top-0 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-bold text-ink ring-2 ring-surface">
                      {count > 9 ? '9+' : count}
                      <span className="sr-only"> {t('unread')}</span>
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">
                  {t(tab.label as Parameters<typeof t>[0])}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
