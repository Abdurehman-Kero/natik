import { MISSING_VALUE } from '@natik/shared/money';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KeyValueItem {
  label: string;
  value: ReactNode;
}

/** Label/value list for details panels. Missing values show "—", never 0 (FR-REP-002). */
export function KeyValue({
  items,
  columns = 1,
  className,
}: {
  items: KeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="font-medium text-ink">
            {item.value === null || item.value === undefined || item.value === ''
              ? MISSING_VALUE
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
