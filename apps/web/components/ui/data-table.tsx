import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /**
   * How the column appears on phones (under 768 px), where rows become cards:
   * "title" (bold first line), "meta" (joined with · under the title),
   * "side" (top-right, e.g. a status pill), or "hidden".
   */
  mobile?: 'title' | 'meta' | 'side' | 'hidden';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible name for each row's actions menu. */
  getRowLabel?: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  /** Describes the table for screen readers. */
  caption: string;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
}

/** Table on desktop, stacked cards on phones (DESIGN.md §11). */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  rowActions,
  caption,
  loading,
  empty,
  className,
}: DataTableProps<T>) {
  const t = useTranslations('table');

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState icon={Inbox} title={t('empty')} />}</>;
  }

  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const meta = columns.filter((c) => c.mobile === 'meta');
  const side = columns.filter((c) => c.mobile === 'side');

  return (
    <div className={className}>
      {/* Phones: one card per row */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={getRowId(row)}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold text-ink">{title?.cell(row)}</div>
                {side.length > 0 ? (
                  <div className="flex shrink-0 gap-1.5">
                    {side.map((c) => (
                      <span key={c.key}>{c.cell(row)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {meta.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                  {meta.map((c, i) => (
                    <span key={c.key} className="flex items-center gap-2">
                      {i > 0 ? <span aria-hidden>·</span> : null}
                      {c.cell(row)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {rowActions ? <div className="-mt-2 -mr-2 shrink-0">{rowActions(row)}</div> : null}
          </li>
        ))}
      </ul>

      {/* Tablet and desktop: a real table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-card md:block">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-canvas/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-sm font-semibold whitespace-nowrap text-muted',
                    c.align === 'end' && 'text-right',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
              {rowActions ? (
                <th scope="col" className="w-14 px-4 py-3">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={getRowId(row)} className="transition-colors hover:bg-canvas/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      c.align === 'end' && 'text-right',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions ? <td className="px-2 py-1.5 text-right">{rowActions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
