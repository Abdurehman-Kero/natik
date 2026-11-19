'use client';

import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  GraduationCap,
  House,
  Info,
  LifeBuoy,
  type LucideIcon,
  Menu,
  MessageSquareText,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AuthLink, useAuthDialog } from '@/components/auth/auth-dialog';
import { Logo } from '@/components/brand/logo';
import { useSiteTools } from '@/components/public/site-tools';
import { useTour } from '@/components/tour/site-tour';
import { buttonVariants, IconButton, LinkButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Container } from '@/components/ui/layout';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HOME_FOR_ROLE } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/use-session';
import { LanguageList, LanguageMenu } from './language-switcher';

interface MainLink {
  key: 'courses' | 'level' | 'teachers' | 'about';
  href: string;
  /** Only from this width up, so the bar never gets crowded. */
  from?: '2xl';
}
const MAIN: MainLink[] = [
  { key: 'courses', href: '/courses' },
  { key: 'level', href: '/find-your-level', from: '2xl' },
  { key: 'teachers', href: '/teachers' },
  { key: 'about', href: '/about' },
];

const PHONE_ICONS: Record<string, LucideIcon> = {
  home: House,
  courses: BookOpen,
  level: ClipboardCheck,
  teachers: GraduationCap,
  about: Info,
  news: Newspaper,
  faq: CircleHelp,
  help: LifeBuoy,
};

const PHONE_LINKS = [
  { key: 'home', href: '/' },
  { key: 'courses', href: '/courses' },
  { key: 'level', href: '/find-your-level' },
  { key: 'teachers', href: '/teachers' },
  { key: 'about', href: '/about' },
  { key: 'news', href: '/news' },
  { key: 'faq', href: '/faq' },
  { key: 'help', href: '/help' },
] as const;

const onPage = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Desktop: logo · main pages · Help menu · search · language · Sign in · Join free.
 * Phone: logo · search · Sign in · menu. Sign in and Join open a dialog, so nobody leaves the page.
 */
export function PublicHeader() {
  const { user } = useSession();
  const dashboardHref = user ? HOME_FOR_ROLE[user.role] : null;
  const t = useTranslations('nav');
  const ts = useTranslations('site');
  const pathname = usePathname();
  const tools = useSiteTools();
  const tour = useTour();
  const auth = useAuthDialog();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const helpActive = ['/help', '/faq', '/news', '/contact', '/verify'].some((p) =>
    onPage(pathname, p),
  );

  /** Close the phone menu first, then open the dialog, so focus returns cleanly. */
  const fromMenu = (action: () => void) => () => {
    setOpen(false);
    window.setTimeout(action, 150);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-surface/92 backdrop-blur-md transition-shadow',
        scrolled
          ? 'border-border shadow-[0_4px_20px_rgb(18_59_90/0.08)]'
          : 'border-border/60 shadow-none',
      )}
    >
      <Container className="flex h-16 items-center gap-1 sm:gap-2 lg:h-[4.5rem]">
        <Logo priority />

        <nav
          aria-label={t('mainNavigation')}
          data-tour="nav"
          className="ml-4 hidden lg:block xl:ml-8"
        >
          <ul className="flex items-center gap-0.5">
            {MAIN.map((item) => {
              const active = onPage(pathname, item.href);
              return (
                <li key={item.href} className={cn(item.from === '2xl' && 'hidden 2xl:block')}>
                  <Link
                    prefetch
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-11 items-center rounded-full px-3.5 font-semibold transition-colors hover:bg-primary-soft hover:text-primary',
                      active ? 'text-primary' : 'text-ink',
                      'after:absolute after:inset-x-4 after:bottom-1 after:h-[3px] after:rounded-full',
                      active ? 'after:bg-accent' : 'after:bg-transparent',
                    )}
                  >
                    {ts(`nav.${item.key}`)}
                  </Link>
                </li>
              );
            })}
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'relative flex min-h-11 items-center gap-1 rounded-full px-3.5 font-semibold transition-colors hover:bg-primary-soft hover:text-primary data-[state=open]:bg-primary-soft data-[state=open]:text-primary',
                      helpActive ? 'text-primary' : 'text-ink',
                      'after:absolute after:inset-x-4 after:bottom-1 after:h-[3px] after:rounded-full',
                      helpActive ? 'after:bg-accent' : 'after:bg-transparent',
                    )}
                  >
                    {ts('nav.help')}
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  <DropdownMenuItem asChild>
                    <Link href="/help">
                      <LifeBuoy aria-hidden /> {ts('nav.helpCentre')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/faq">
                      <CircleHelp aria-hidden /> {ts('nav.faq')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/news">
                      <Newspaper aria-hidden /> {ts('nav.news')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => tools.open('contact')}>
                    <MessageSquareText aria-hidden /> {ts('nav.contact')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => tools.open('verify')}>
                    <ShieldCheck aria-hidden /> {ts('nav.verify')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={tour.start}>
                    <Sparkles aria-hidden /> {ts('header.tour')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          <button
            type="button"
            data-tour="search"
            onClick={() => tools.open('search')}
            aria-label={ts('header.searchLabel')}
            className="hidden h-11 items-center gap-2 rounded-full border border-border bg-canvas px-3.5 text-muted transition-colors hover:border-primary hover:text-primary 2xl:flex"
          >
            <Search className="size-4.5" aria-hidden />
            <span className="text-[0.9375rem]">{ts('header.search')}</span>
            <kbd className="rounded border border-border-strong bg-surface px-1.5 text-xs font-semibold">
              /
            </kbd>
          </button>
          <IconButton
            label={ts('header.searchLabel')}
            data-tour="search"
            onClick={() => tools.open('search')}
            className="hidden lg:inline-flex 2xl:hidden"
          >
            <Search />
          </IconButton>

          <span data-tour="language" className="inline-flex">
            <LanguageMenu />
          </span>

          <span data-tour="account" className="flex items-center gap-1 sm:gap-1.5">
            {dashboardHref ? (
              <LinkButton href={dashboardHref} size="sm" className="hidden lg:inline-flex">
                {t('public.dashboard')}
              </LinkButton>
            ) : (
              <>
                <AuthLink
                  mode="sign-in"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'hidden px-3 sm:px-4 lg:inline-flex',
                  )}
                >
                  {t('public.signIn')}
                </AuthLink>
                <AuthLink
                  mode="register"
                  className={cn(buttonVariants({ size: 'sm' }), 'hidden lg:inline-flex')}
                >
                  {ts('header.join')}
                </AuthLink>
              </>
            )}
          </span>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <IconButton label={t('openMenu')} data-tour="menu" className="lg:hidden">
                <Menu />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="right" aria-describedby={undefined}>
              <SheetTitle className="sr-only">{t('mainNavigation')}</SheetTitle>
              <div className="flex h-16 items-center px-4">
                <Logo />
              </div>
              <nav aria-label={t('mainNavigation')} className="flex-1 px-3 py-2">
                <ul className="flex flex-col gap-0.5">
                  {PHONE_LINKS.map((item) => {
                    const Icon = PHONE_ICONS[item.key] ?? BookOpen;
                    const active =
                      item.href === '/' ? pathname === '/' : onPage(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          prefetch
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-12 items-center gap-3 rounded-xl px-3 text-[1.0625rem] font-semibold',
                            active ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas',
                          )}
                        >
                          <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                          {item.key === 'help' ? ts('nav.helpCentre') : ts(`nav.${item.key}`)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={fromMenu(() => tools.open('search'))}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-start text-[1.0625rem] font-semibold text-ink hover:bg-canvas"
                  >
                    <Search className="size-5 shrink-0 text-primary" aria-hidden />
                    {ts('header.searchLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={fromMenu(() => tools.open('contact'))}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-start text-[1.0625rem] font-semibold text-ink hover:bg-canvas"
                  >
                    <MessageSquareText className="size-5 shrink-0 text-primary" aria-hidden />
                    {ts('nav.contact')}
                  </button>
                  <button
                    type="button"
                    onClick={fromMenu(() => tools.open('verify'))}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-start text-[1.0625rem] font-semibold text-ink hover:bg-canvas"
                  >
                    <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
                    {ts('nav.verify')}
                  </button>
                  <button
                    type="button"
                    onClick={fromMenu(tour.start)}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-start text-[1.0625rem] font-semibold text-ink hover:bg-canvas"
                  >
                    <Sparkles className="size-5 shrink-0 text-accent-strong" aria-hidden />
                    {ts('header.tour')}
                  </button>
                </div>
              </nav>
              <div className="border-t border-border p-4 sm:hidden">
                <LanguageList onChosen={() => setOpen(false)} />
              </div>
              {!dashboardHref ? (
                <div className="flex flex-col gap-2 border-t border-border p-4">
                  <button
                    type="button"
                    onClick={fromMenu(() => auth.open('register'))}
                    className={buttonVariants({ size: 'lg', fullWidth: true })}
                  >
                    {ts('header.join')}
                  </button>
                  <button
                    type="button"
                    onClick={fromMenu(() => auth.open('sign-in'))}
                    className={buttonVariants({
                      variant: 'secondary',
                      size: 'lg',
                      fullWidth: true,
                    })}
                  >
                    {t('public.signIn')}
                  </button>
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
