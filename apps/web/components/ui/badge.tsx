import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { toneClass } from './status-pill';

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof toneClass;
}

/** Small label, e.g. "Free" on a lesson or a language tag on a course. */
export function Badge({ tone = 'primary', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold whitespace-nowrap',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Count bubble for navigation ("Payments to check 5"). Hidden at zero. */
export function CountBadge({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
