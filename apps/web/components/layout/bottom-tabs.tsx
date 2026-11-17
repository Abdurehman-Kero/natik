'use client';

import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { isActive, studentNav, studentPhoneTabs } from './nav';

/** Student phone navigation: four tabs within thumb reach (DESIGN.md §8). */
export function BottomTabs({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('mainNavigation')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {studentPhoneTabs.map((tab) => {
          const item = studentNav.find((n) => n.href === tab.href)!;
          const active = isActive(pathname, item);
          const short = tab.label;
          return (
            <li key={item.href}>
              <Link
                prefetch
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-center text-xs leading-tight font-semibold transition-colors',
                  active ? 'text-primary' : 'text-muted hover:text-primary',
                  'before:absolute before:top-0 before:h-[3px] before:w-8 before:rounded-full',
                  active ? 'before:bg-accent' : 'before:bg-transparent',
                )}
              >
                <item.icon className="size-6" aria-hidden />
                <span>{t(short as Parameters<typeof t>[0])}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
