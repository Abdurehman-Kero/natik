import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon: LucideIcon;
  /** At most 5 words. */
  title: string;
  /** One line. */
  description?: string;
  /** One button. */
  action?: ReactNode;
  /** Heading level, so pages keep a correct outline. */
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

/** Icon + title + one line + one action. Never a dead end (DESIGN.md §10). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  as: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
      <span
        className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden
      >
        <Icon className="size-7" />
      </span>
      <Heading className="text-xl font-semibold">{title}</Heading>
      {description ? <p className="max-w-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
