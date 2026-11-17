'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import Link from '@/components/ui/link';
import { Slot } from 'radix-ui';
import type { ComponentProps, MouseEventHandler, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useHydrated } from '@/lib/use-hydrated';

/**
 * One primary button per view (DESIGN.md §1). Every size keeps a 44px tap target.
 * `accent` (gold) is for celebratory moments only (e.g. "Download certificate").
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none',
    'transition duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 data-[waiting]:disabled:opacity-100',
    '[&_svg]:pointer-events-none [&_svg]:size-4.5 [&_svg]:shrink-0 md:[&_svg]:size-5',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white hover:bg-primary-hover hover:shadow-raised active:bg-primary-hover',
        secondary:
          'border border-primary bg-surface text-primary hover:bg-primary-soft active:bg-primary-soft',
        ghost: 'text-primary hover:bg-primary-soft active:bg-primary-soft',
        danger: 'bg-danger text-white hover:bg-danger-hover active:bg-danger-hover',
        // Ink on gold is 5.4:1 (navy on gold is only 4.3:1), so it passes at any size.
        accent: 'bg-accent font-bold text-ink hover:brightness-95',
        onDark: 'bg-white text-primary hover:bg-primary-soft',
        outlineOnDark: 'border border-white/70 text-white hover:bg-white/10',
      },
      size: {
        sm: 'h-10 px-3.5 text-sm md:h-11 md:px-4',
        md: 'h-10 px-4 text-[0.9375rem] md:h-11 md:px-5 md:text-base',
        lg: 'h-12 px-5 text-base md:h-13 md:px-7 md:text-lg',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ComponentProps<'button'>, ButtonVariantProps {
  /** Render the child element (e.g. a link) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, keeps the label, and blocks repeat clicks. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const hydrated = useHydrated();
  // A submit button does nothing until the page's JavaScript is ready (slow connections).
  const waiting = (type ?? 'button') === 'submit' && !hydrated;
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading || waiting}
      data-waiting={waiting || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ButtonVariantProps {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/** A link that looks like a button (navigation, not an action). */
export function LinkButton({
  href,
  children,
  className,
  variant,
  size,
  fullWidth,
  prefetch,
  onClick,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={onClick}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {children}
    </Link>
  );
}

/** A button-looking link to another website: opens in a new tab and does not pass the page along. */
export function ExternalLinkButton({
  href,
  children,
  className,
  variant,
  size,
  fullWidth,
}: Omit<LinkButtonProps, 'prefetch' | 'onClick'>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {children}
    </a>
  );
}

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5',
  ],
  {
    variants: {
      variant: {
        ghost: 'text-ink hover:bg-primary-soft hover:text-primary',
        secondary: 'border border-border-strong bg-surface text-primary hover:bg-primary-soft',
        primary: 'bg-primary text-white hover:bg-primary-hover',
        onDark: 'text-white hover:bg-white/10',
      },
      size: { sm: 'size-9', md: 'size-11' },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends Omit<ComponentProps<'button'>, 'aria-label'>, VariantProps<typeof iconButtonVariants> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export function IconButton({
  label,
  className,
  variant,
  size,
  type,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
