import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Placeholder shaped like the content that is loading (never a full-page spinner). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-lg bg-subtle', className)} {...props} />
  );
}

/** Ready-made skeleton for a course card grid. */
export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <Skeleton className="aspect-video rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-3 h-5 w-1/4" />
      </div>
    </div>
  );
}
