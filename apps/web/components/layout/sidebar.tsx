'use client';

import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CountBadge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { isActive, type NavGroup, type NavItem } from './nav';

export type BadgeCounts = Partial<Record<NonNullable<NavItem['badge']>, number>>;

export interface SidebarNavProps {
  groups: NavGroup[];
  badges?: BadgeCounts;
  /** Icons only (desktop collapsed mode). Labels stay available to screen readers. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Grouped navigation for the teacher and admin areas (DESIGN.md §8). */
export function SidebarNav({
  groups,
  badges = {},
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('mainNavigation')} className="flex flex-col gap-4">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? groupIndex} className="flex flex-col gap-0.5">
          {group.label && !collapsed ? (
            <span className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted uppercase">
              {t(group.label as Parameters<typeof t>[0])}
            </span>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const label = t(item.label as Parameters<typeof t>[0]);
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;
              const link = (
                <Link
                  prefetch
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-primary-soft font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent'
                      : 'text-ink hover:bg-canvas hover:text-primary',
                  )}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{label}</span>
                  <CountBadge
                    count={count}
                    label={t('unread')}
                    className={cn(collapsed && 'absolute top-1 right-1')}
                  />
                </Link>
              );
              return (
                <li key={item.href + item.label}>
                  {collapsed ? (
                    <Tooltip content={label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
