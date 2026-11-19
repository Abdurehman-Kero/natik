'use client';

import { HelpCircle, LogOut, Menu } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { useTour } from '@/components/tour/site-tour';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LanguageList } from './language-switcher';
import { studentMenuGroups } from './nav';
import { type BadgeCounts, SidebarNav } from './sidebar';
import type { ShellUser } from './student-shell';

/**
 * The menu button at the top left of the student area on phones and tablets. It opens a drawer with
 * every page grouped under "Learn" and "My account", the person's name and photo, the language
 * choice, a short guide, and sign out. Nothing in the area is more than two taps away.
 */
export function StudentMenu({ user, badges }: { user?: ShellUser | null; badges: BadgeCounts }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const tour = useTour();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label={t('openMenu')} data-tour="student-menu" className="-ml-2 lg:hidden">
          <Menu />
        </IconButton>
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetTitle className="sr-only">{t('student.menuTitle')}</SheetTitle>
        <div className="flex h-16 shrink-0 items-center px-4">
          <Logo href="/dashboard" />
        </div>

        {user?.name ? (
          <div className="mx-3 mb-2 flex items-center gap-1 rounded-2xl bg-primary-soft p-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-white/60"
            >
              <Avatar name={user.name} src={user.photoUrl} size="md" decorative />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{user.name}</span>
                <span className="block text-sm font-medium text-primary">
                  {t('student.viewProfile')}
                </span>
              </span>
            </Link>
            <Link
              href="/sign-out"
              prefetch={false}
              aria-label={t('signOut')}
              title={t('signOut')}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white/60 hover:text-primary"
            >
              <LogOut className="size-5" aria-hidden />
            </Link>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav
            groups={studentMenuGroups}
            badges={badges}
            onNavigate={() => setOpen(false)}
          />
        </div>

        <div className="flex flex-col gap-1 border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.setTimeout(tour.start, 200);
            }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-start font-medium text-ink hover:bg-canvas"
          >
            <HelpCircle className="size-5 shrink-0 text-accent-strong" aria-hidden />
            {t('student.howItWorks')}
          </button>
          <div className="px-1 py-1 sm:hidden">
            <LanguageList onChosen={() => setOpen(false)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
