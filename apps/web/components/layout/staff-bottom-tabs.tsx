'use client';

import {
  BookOpen,
  ClipboardCheck,
  House,
  type LucideIcon,
  Menu,
  MessageCircle,
  UserCheck,
  UsersRound,
  Wallet,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { isActive, type NavItem } from './nav';
import type { BadgeCounts } from './sidebar';

interface Tab {
  /** Where it goes; "more" opens the menu instead. */
  href: string | null;
  label:
    'home' | 'courses' | 'marking' | 'groups' | 'messages' | 'enrolments' | 'payments' | 'more';
  icon: LucideIcon;
  exact?: boolean;
  badge?: NavItem['badge'];
}

/** The five things teachers reach for most; everything else is in the menu button at the top left. */
const TEACHER: Tab[] = [
  { href: '/teach', label: 'home', icon: House, exact: true },
  { href: '/teach/courses', label: 'courses', icon: BookOpen },
  { href: '/teach/marking', label: 'marking', icon: ClipboardCheck, badge: 'marking' },
  { href: '/teach/groups', label: 'groups', icon: UsersRound, badge: 'groups' },
  { href: '/teach/chat', label: 'messages', icon: MessageCircle, badge: 'chat' },
];

/** Admins have too many pages for five tabs, so the last tab is "More", which opens the full menu. */
const ADMIN: Tab[] = [
  { href: '/admin', label: 'home', icon: House, exact: true },
  { href: '/admin/enrolments', label: 'enrolments', icon: UserCheck, badge: 'enrolments' },
  { href: '/admin/courses', label: 'courses', icon: BookOpen },
  { href: '/admin/payments', label: 'payments', icon: Wallet, badge: 'payments' },
  { href: null, label: 'more', icon: Menu },
];

const tabClass = (active: boolean) =>
  cn(
    'relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-0.5 text-center text-[0.6875rem] leading-tight font-semibold transition-colors',
    active ? 'text-primary' : 'text-muted hover:text-primary',
    'before:absolute before:top-0 before:h-[3px] before:w-8 before:rounded-full',
    active ? 'before:bg-accent' : 'before:bg-transparent',
  );

/**
 * Phones only: five labelled tabs along the bottom of the teacher and admin areas, like the student
 * area, with a number on the ones that have something waiting (marking, groups, messages,
 * enrolments, payments).
 */
export function StaffBottomTabs({
  area,
  badges,
  onMore,
  className,
}: {
  area: 'teacher' | 'admin';
  badges: BadgeCounts;
  onMore: () => void;
  className?: string;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const tabs = area === 'admin' ? ADMIN : TEACHER;

  return (
    <nav
      aria-label={t('quickNavigation')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(18_59_90/0.06)] backdrop-blur-md',
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const count = tab.badge ? (badges[tab.badge] ?? 0) : 0;
          const active = tab.href
            ? isActive(pathname, { href: tab.href, exact: tab.exact })
            : false;
          const content = (
            <>
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
              <span className="max-w-full truncate">{t(`staff.${tab.label}`)}</span>
            </>
          );
          return (
            <li key={tab.label}>
              {tab.href ? (
                <Link
                  prefetch
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={tabClass(active)}
                >
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={onMore} className={tabClass(false)}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
