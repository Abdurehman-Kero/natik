'use client';

import { Menu } from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { IconButton, LinkButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HOME_FOR_ROLE } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/use-session';
import { LanguageList, LanguageMenu } from './language-switcher';
import { isActive, publicNav } from './nav';

/** Phone: logo · Sign in · menu. Desktop: logo · 4 links · Sign in · Register. */
export function PublicHeader() {
  const { user } = useSession();
  const dashboardHref = user ? HOME_FOR_ROLE[user.role] : null;
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface shadow-[0_1px_12px_rgb(18_59_90/0.05)]">
      <Container className="flex h-16 items-center gap-2 sm:gap-4 lg:h-[4.5rem]">
        <Logo priority />

        <nav aria-label={t('mainNavigation')} className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {publicNav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    prefetch
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-11 items-center rounded-full px-4 font-semibold transition-colors hover:bg-primary-soft hover:text-primary',
                      active ? 'text-primary' : 'text-ink',
                      'after:absolute after:inset-x-5 after:bottom-1 after:h-[3px] after:rounded-full',
                      active ? 'after:bg-accent' : 'after:bg-transparent',
                    )}
                  >
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageMenu className="hidden sm:inline-flex" />
          {dashboardHref ? (
            <LinkButton href={dashboardHref} size="sm">
              {t('public.dashboard')}
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost" size="sm" className="px-3 sm:px-4">
                {t('public.signIn')}
              </LinkButton>
              <LinkButton href="/register" size="sm" className="hidden lg:inline-flex">
                {t('public.register')}
              </LinkButton>
            </>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <IconButton label={t('openMenu')} className="lg:hidden">
                <Menu />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="right" aria-describedby={undefined}>
              <SheetTitle className="sr-only">{t('mainNavigation')}</SheetTitle>
              <div className="flex h-16 items-center px-4">
                <Logo />
              </div>
              <nav aria-label={t('mainNavigation')} className="flex-1 px-3 py-2">
                <ul className="flex flex-col gap-1">
                  {publicNav.map((item) => {
                    const active = isActive(pathname, item);
                    return (
                      <li key={item.href}>
                        <Link
                          prefetch
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 items-center rounded-lg px-3 text-lg font-semibold',
                            active ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas',
                          )}
                        >
                          {t(item.label)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-t border-border p-4 sm:hidden">
                <LanguageList onChosen={() => setOpen(false)} />
              </div>
              {!dashboardHref ? (
                <div className="flex flex-col gap-2 border-t border-border p-4">
                  <LinkButton href="/register" fullWidth>
                    {t('public.register')}
                  </LinkButton>
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
