import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TimelineItem {
  id: string;
  title: ReactNode;
  time: string;
  description?: ReactNode;
  tone?: 'primary' | 'accent' | 'danger' | 'muted';
}

const dotTone = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  danger: 'bg-danger',
  muted: 'bg-border-strong',
} as const;

/** History of a record, e.g. enrolment changes: who did what, when. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < items.length - 1 ? (
            <span className="absolute top-4 left-[5px] h-full w-px bg-border" aria-hidden />
          ) : null}
          <span
            className={cn(
              'relative mt-1.5 size-3 shrink-0 rounded-full',
              dotTone[item.tone ?? 'primary'],
            )}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium text-ink">{item.title}</span>
            <span className="text-sm text-muted">{item.time}</span>
            {item.description ? (
              <span className="mt-0.5 text-sm text-ink">{item.description}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
