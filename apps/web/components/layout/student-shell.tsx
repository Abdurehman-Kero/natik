'use client';

import { PageFade } from '@/components/brand/page-fade';
import { Bell, LogOut, MessageCircle, UserRound } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Container } from '@/components/ui/layout';
import { useLiveCounts } from '@/lib/use-live-counts';
import { BottomTabs } from './bottom-tabs';
import { studentNav } from './nav';
import { SidebarNav } from './sidebar';

export interface ShellUser {
  name: string;
  photoUrl?: string | null;
}

export interface StudentShellProps {
  children: ReactNode;
  /** Filled in M2 from the session. */
  user?: ShellUser | null;
  /** Unread announcements (M5). */
  unread?: number;
  /** Unread chat messages. */
  chatUnread?: number;
}

/** Student area: top bar with announcements + account; 4 bottom tabs on phones, sidebar on desktop. */
export function StudentShell({
  children,
  user,
  unread = 0,
  chatUnread: chatUnreadInitial = 0,
}: StudentShellProps) {
  const chatUnread = useLiveCounts({ chat: chatUnreadInitial }).chat ?? 0;
  const t = useTranslations('nav');
  const name = user?.name ?? '';

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-[4.5rem] items-center px-5">
          <Logo href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav groups={[{ label: null, items: studentNav }]} badges={{ chat: chatUnread }} />
        </div>
        <div className="border-t border-border p-3">
          <Link
            href="/sign-out"
            prefetch={false}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium text-ink hover:bg-primary-soft hover:text-primary"
          >
            <LogOut className="size-5" aria-hidden />
            {t('signOut')}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <Container className="flex h-16 items-center gap-2">
            <Logo href="/dashboard" variant="mark" className="sm:hidden" />
            <Logo href="/dashboard" className="hidden sm:inline-flex lg:hidden" />
            <div className="ml-auto flex items-center gap-1">
              <Link
                prefetch
                href="/chat"
                className="relative flex size-11 items-center justify-center rounded-xl text-ink hover:bg-primary-soft hover:text-primary"
                aria-label={
                  chatUnread > 0
                    ? `${t('student.chat')} (${chatUnread} ${t('unread')})`
                    : t('student.chat')
                }
              >
                <MessageCircle className="size-5" aria-hidden />
                {chatUnread > 0 ? (
                  <span
                    className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-accent ring-2 ring-surface"
                    aria-hidden
                  />
                ) : null}
              </Link>
              <Link
                prefetch
                href="/announcements"
                className="relative flex size-11 items-center justify-center rounded-xl text-ink hover:bg-primary-soft hover:text-primary"
                aria-label={
                  unread > 0
                    ? `${t('notifications')} (${unread} ${t('unread')})`
                    : t('notifications')
                }
              >
                <Bell className="size-5" aria-hidden />
                {unread > 0 ? (
                  <span
                    className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-accent ring-2 ring-surface"
                    aria-hidden
                  />
                ) : null}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex size-11 items-center justify-center rounded-xl hover:bg-primary-soft"
                  aria-label={t('accountMenu')}
                >
                  {name ? (
                    <Avatar name={name} src={user?.photoUrl} size="sm" decorative />
                  ) : (
                    <UserRound className="size-5 text-ink" aria-hidden />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <UserRound aria-hidden />
                      {t('student.profile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/sign-out" prefetch={false}>
                      <LogOut aria-hidden />
                      {t('signOut')}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Container>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 pt-6 pb-28 focus:outline-none md:pt-8 lg:pb-10"
        >
          <Container>
            <PageFade>{children}</PageFade>
          </Container>
        </main>
      </div>

      <BottomTabs className="lg:hidden" />
    </div>
  );
}
