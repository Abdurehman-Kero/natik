import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from '@/components/ui/link';
import type { ComponentProps, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Page width + side gutters: 16 px phone, 24 px tablet, 32 px desktop (DESIGN.md §4). */
export function Container({
  as: Tag = 'div',
  size = 'page',
  className,
  ...props
}: ComponentProps<'div'> & { as?: ElementType; size?: 'page' | 'reading' }) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full px-4 md:px-6 lg:px-8',
        size === 'page' ? 'max-w-[1200px]' : 'max-w-[760px]',
        className,
      )}
      {...props}
    />
  );
}

export interface PageHeaderProps {
  /** At most 5 words. */
  title: string;
  /** Optional, one line. */
  subtitle?: string;
  /** The page's one primary action. */
  action?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}

/** Title + optional one-line subtitle + one action. Used at the top of every app page. */
export function PageHeader({ title, subtitle, action, back, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 pb-6', className)}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-tight font-bold md:text-4xl">{title}</h1>
          {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 gap-3">{action}</div> : null}
      </div>
    </header>
  );
}

export interface SectionHeadingProps {
  /** At most 4 words. */
  title: string;
  as?: 'h2' | 'h3';
  /** Optional "See all →" link. */
  link?: { href: string; label: string };
  onDark?: boolean;
  /** A short label above the title (small gold capitals). */
  eyebrow?: string;
  /** The bigger, centred heading used on the public pages. */
  large?: boolean;
  className?: string;
}

/** Section title with the small gold bar taken from the logo's quill stroke. */
export function SectionHeading({
  title,
  as: Heading = 'h2',
  link,
  onDark,
  eyebrow,
  large,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-6 flex flex-col items-center gap-2 text-center md:mb-8', className)}>
      <div className="flex flex-col items-center gap-2">
        {eyebrow ? (
          <span
            className={cn(
              'text-sm font-bold tracking-[0.18em] uppercase',
              onDark ? 'text-accent' : 'text-accent-strong',
            )}
          >
            {eyebrow}
          </span>
        ) : (
          <span className="block h-[3px] w-8 rounded-full bg-accent" aria-hidden />
        )}
        <Heading
          className={cn(
            'leading-tight font-semibold',
            large
              ? 'text-2xl font-bold tracking-[-0.01em] md:text-[2.5rem]'
              : 'text-xl md:text-[1.75rem]',
            onDark && 'text-white',
          )}
        >
          {title}
        </Heading>
      </div>
      {link ? (
        <Link
          href={link.href}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold hover:underline',
            onDark ? 'text-white' : 'text-primary',
          )}
        >
          {link.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Keeps the main action within thumb reach on phones (fixed to the bottom),
 * and sits inline from the md breakpoint up. Renders a spacer so content isn't hidden.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-3 pb-safe shadow-raised',
          'md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none',
          className,
        )}
      >
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 [&>*]:flex-1 md:[&>*]:flex-none">
          {children}
        </div>
      </div>
    </>
  );
}
