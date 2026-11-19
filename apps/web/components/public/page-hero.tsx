import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Link from '@/components/ui/link';
import { Container } from '@/components/ui/layout';
import { cn } from '@/lib/cn';
import mark from '@/public/brand/natik-mark.png';

export interface PageHeroProps {
  eyebrow?: string;
  /** The page's one H1. */
  title: string;
  subtitle?: string;
  /** Buttons under the text. */
  children?: ReactNode;
  /** Pages between Home and this one, e.g. [{ label: 'Courses', href: '/courses' }]. */
  trail?: { label: string; href: string }[];
  /** Hide the "Home › Title" line (the home page does not use this component anyway). */
  noCrumbs?: boolean;
  /** "home" is taller and left-aligned with a bigger watermark. */
  size?: 'home' | 'page';
  className?: string;
}

/** Navy band at the top of every public page: first impression, one clear message. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  size = 'page',
  trail = [],
  noCrumbs,
  className,
}: PageHeroProps) {
  const tn = useTranslations('site.nav');
  return (
    <section
      className={cn(
        'on-dark relative overflow-hidden bg-linear-to-br from-primary via-primary to-[#0b2a42] text-white',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(182_154_74/0.16),transparent)]"
        aria-hidden
      />
      <Image
        src={mark}
        alt=""
        aria-hidden
        sizes="420px"
        priority={size === 'home'}
        className={cn(
          'pointer-events-none absolute w-auto opacity-[0.07] brightness-0 invert',
          size === 'home'
            ? '-top-6 -right-20 h-[22rem] md:-right-6 md:h-[30rem]'
            : '-top-4 -right-16 h-60 md:right-4 md:h-80',
        )}
      />
      <Container
        className={cn(
          'relative flex flex-col gap-4',
          size === 'page' && 'items-center text-center',
          size === 'home' ? 'py-14 md:py-24' : 'py-14 md:py-20',
        )}
      >
        {size === 'page' && !noCrumbs ? (
          <nav aria-label={tn('breadcrumb')} className="mb-1">
            <ol className="flex flex-wrap items-center justify-center gap-1 text-sm text-white/75">
              {[{ label: tn('home'), href: '/' }, ...trail].map((crumb) => (
                <li key={crumb.href} className="flex items-center gap-1">
                  <Link href={crumb.href} className="rounded px-1 hover:text-white hover:underline">
                    {crumb.label}
                  </Link>
                  <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
                </li>
              ))}
              <li aria-current="page" className="px-1 font-semibold text-white/95">
                {title}
              </li>
            </ol>
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.14em] text-white/80 uppercase">
            <span className="h-[3px] w-6 rounded-full bg-accent" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            'max-w-3xl leading-[1.15] font-bold text-white',
            size === 'home' ? 'text-[1.875rem] md:text-5xl' : 'text-[1.75rem] md:text-5xl',
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              'max-w-2xl text-white/85',
              size === 'home' ? 'text-base md:text-xl' : 'text-base md:text-lg',
            )}
          >
            {subtitle}
          </p>
        ) : null}
        {children ? (
          <div
            className={cn(
              'mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap',
              size === 'page' && 'justify-center',
            )}
          >
            {children}
          </div>
        ) : null}
      </Container>
      <span
        className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-accent/70 to-transparent"
        aria-hidden
      />
    </section>
  );
}
