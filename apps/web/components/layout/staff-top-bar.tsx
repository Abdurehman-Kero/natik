'use client';

import {
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CountKey, Counts } from '@/lib/use-live-counts';
import type { ShellUser } from './student-shell';

interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: CountKey;
}

/** What each role needs one tap away: the queues that wait for them and their chats. */
const ACTIONS: Record<'admin' | 'teacher', QuickAction[]> = {
  admin: [
    { href: '/admin/payments', label: 'admin.payments', icon: CreditCard, count: 'payments' },
    { href: '/admin/messages', label: 'admin.messages', icon: Mail, count: 'messages' },
    { href: '/admin/chat', label: 'admin.chat', icon: MessageCircle, count: 'chat' },
  ],
  teacher: [
    { href: '/teach/marking', label: 'teacher.marking', icon: ClipboardCheck, count: 'marking' },
    { href: '/teach/chat', label: 'teacher.chat', icon: MessageCircle, count: 'chat' },
    { href: '/teach/announcements', label: 'teacher.announcements', icon: Megaphone },
  ],
};

/**
 * The top bar of the admin and teacher areas: the area's name, quick links with their live counts
 * (payments, messages, chats, marking), a link to the public website and the account menu.
 * On phones it also holds the menu button that opens the side drawer.
 */
export function StaffTopBar({
  area,
  user,
  counts,
  home,
  menu,
}: {
  area: 'admin' | 'teacher';
  user?: ShellUser | null;
  counts: Counts;
  home: string;
  /** The phone-only menu button (opens the drawer). */
  menu: ReactNode;
}) {
  const t = useTranslations('nav');
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-2 sm:px-4 lg:px-8">
        <div className="lg:hidden">{menu}</div>
        <Logo href={home} variant="mark" className="sm:hidden" />
        <Logo href={home} className="hidden sm:inline-flex lg:hidden" />
        <p className="hidden items-center gap-2 font-sans text-sm font-semibold tracking-wider text-muted uppercase lg:flex">
          <span className="h-[3px] w-6 rounded-full bg-accent" aria-hidden />
          {t(area === 'admin' ? 'areaAdmin' : 'areaTeacher')}
        </p>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {ACTIONS[area].map((action) => {
            const count = action.count ? (counts[action.count] ?? 0) : 0;
            const label = t(action.label as Parameters<typeof t>[0]);
            return (
              <Link
                prefetch
                key={action.href}
                href={action.href}
                title={label}
                className="relative flex size-11 items-center justify-center rounded-xl text-ink hover:bg-primary-soft hover:text-primary"
              >
                <action.icon className="size-5" aria-hidden />
                <span className="sr-only">{label}</span>
                {count > 0 ? (
                  <span className="absolute top-1 right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] font-bold text-ink ring-2 ring-surface">
                    {count > 99 ? '99+' : count}
                    <span className="sr-only"> {t('unread')}</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
          <Link
            prefetch
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title={t('viewSite')}
            className="hidden size-11 items-center justify-center rounded-xl text-ink hover:bg-primary-soft hover:text-primary sm:flex"
          >
            <ExternalLink className="size-5" aria-hidden />
            <span className="sr-only">{t('viewSite')}</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="ml-1 flex h-11 items-center gap-2 rounded-xl px-1.5 hover:bg-primary-soft sm:px-2"
              aria-label={user?.name ? `${t('accountMenu')}: ${user.name}` : t('accountMenu')}
            >
              {user?.name ? (
                <Avatar name={user.name} src={user.photoUrl} size="sm" decorative />
              ) : (
                <UserRound className="size-5 text-ink" aria-hidden />
              )}
              <span className="hidden max-w-36 truncate text-sm font-semibold text-ink md:block">
                {user?.name}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {user?.name ? <DropdownMenuLabel>{user.name}</DropdownMenuLabel> : null}
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserRound aria-hidden /> {t('teacher.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden /> {t('viewSite')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild tone="danger">
                <Link href="/sign-out" prefetch={false}>
                  <LogOut aria-hidden /> {t('signOut')}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
