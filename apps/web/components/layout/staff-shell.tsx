'use client';

import { PageFade } from '@/components/brand/page-fade';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useStoredFlag } from '@/lib/use-stored-flag';
import { useLiveCounts } from '@/lib/use-live-counts';
import { adminNav, teacherNav } from './nav';
import { StaffBottomTabs } from './staff-bottom-tabs';
import { StaffTopBar } from './staff-top-bar';
import { type BadgeCounts, SidebarNav } from './sidebar';
import type { ShellUser } from './student-shell';

const COLLAPSE_KEY = 'natik.sidebar.collapsed';

export interface StaffShellProps {
  area: 'teacher' | 'admin';
  children: ReactNode;
  /** Filled in M2 from the session. */
  user?: ShellUser | null;
  /** Queue counts (marking M6, payments M5, messages M4). */
  badges?: BadgeCounts;
}

/** Teacher and admin areas: grouped sidebar (collapsible on desktop, a drawer on phones). */
export function StaffShell({ area, children, user, badges }: StaffShellProps) {
  const t = useTranslations('nav');
  const groups = area === 'admin' ? adminNav : teacherNav;
  const home = area === 'admin' ? '/admin' : '/teach';
  // Remembered per browser (falls back to expanded when storage is unavailable).
  const [collapsed, setCollapsed] = useStoredFlag(COLLAPSE_KEY);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Menu numbers stay current: they drop as soon as chats, messages or marking are seen to.
  const counts = useLiveCounts(badges ?? {});
  const toggle = () => setCollapsed(!collapsed);

  const account = (compact: boolean) => (
    <div className={cn('flex items-center gap-2', compact ? 'flex-col' : '')}>
      <Link
        href="/profile"
        className={cn(
          'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 hover:bg-canvas',
          compact && 'justify-center px-0',
        )}
      >
        {user?.name ? (
          <Avatar name={user.name} src={user.photoUrl} size="sm" />
        ) : (
          <UserRound className="size-5" aria-hidden />
        )}
        <span className={cn('truncate font-medium text-ink', compact && 'sr-only')}>
          {user?.name ?? t('teacher.profile')}
        </span>
      </Link>
      <Link
        href="/sign-out"
        aria-label={t('signOut')}
        title={t('signOut')}
        className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-primary"
      >
        <LogOut className="size-5" aria-hidden />
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className={cn('flex h-[4.5rem] items-center', collapsed ? 'justify-center' : 'px-5')}>
          <Logo href={home} variant={collapsed ? 'mark' : 'compact'} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav groups={groups} badges={counts} collapsed={collapsed} />
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {account(collapsed)}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted hover:bg-canvas hover:text-primary',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden />
            )}
            <span className={cn(collapsed && 'sr-only')}>
              {collapsed ? t('expandSidebar') : t('collapseSidebar')}
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopBar
          area={area}
          user={user}
          counts={counts}
          home={home}
          menu={
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <IconButton label={t('openMenu')}>
                  <Menu />
                </IconButton>
              </SheetTrigger>
              <SheetContent side="left" aria-describedby={undefined}>
                <SheetTitle className="sr-only">{t('mainNavigation')}</SheetTitle>
                <div className="flex h-16 items-center px-5">
                  <Logo href={home} />
                </div>
                <div className="flex-1 px-3 py-2">
                  <SidebarNav
                    groups={groups}
                    badges={counts}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
                <div className="border-t border-border p-3">{account(false)}</div>
              </SheetContent>
            </Sheet>
          }
        />

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 py-6 pb-24 focus:outline-none md:py-8 lg:pb-8"
        >
          <Container>
            <PageFade>{children}</PageFade>
          </Container>
        </main>
      </div>

      <StaffBottomTabs
        area={area}
        badges={counts}
        onMore={() => setMobileOpen(true)}
        className="lg:hidden"
      />
    </div>
  );
}
