'use client';

import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-3xl',
} as const;

/** "Abdi Kedir" → "AK" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  /** Inside a button or link that already has its own label (e.g. the account menu). */
  decorative?: boolean;
  className?: string;
}

/** Photo with an initials fallback (most students won't upload a photo). */
export function Avatar({ name, src, size = 'md', decorative = false, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft align-middle select-none',
        sizes[size],
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={decorative ? '' : name}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className="font-heading font-semibold text-primary"
        delayMs={src ? 300 : 0}
      >
        {decorative ? (
          // Drawn by CSS, so it is not separate visible text for the parent's accessible name.
          <span
            aria-hidden
            data-initials={initials(name)}
            className="before:content-[attr(data-initials)]"
          />
        ) : (
          <>
            <span aria-hidden>{initials(name)}</span>
            <span className="sr-only">{name}</span>
          </>
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
