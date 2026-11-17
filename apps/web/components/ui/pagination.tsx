import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** 1 … 4 5 6 … 12 */
export function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Builds the URL for a page, so pagination works without JavaScript and survives refresh. */
  hrefFor: (page: number) => string;
  className?: string;
}

const itemClass =
  'flex size-11 items-center justify-center rounded-lg font-semibold transition-colors hover:bg-primary-soft hover:text-primary';

export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  const t = useTranslations('pagination');
  if (totalPages <= 1) return null;
  const prev = page > 1 ? hrefFor(page - 1) : null;
  const next = page < totalPages ? hrefFor(page + 1) : null;

  const arrow = (href: string | null, label: string, icon: ReactNode) =>
    href ? (
      <Link href={href} aria-label={label} className={cn(itemClass, 'text-primary')}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden className={cn(itemClass, 'pointer-events-none text-border-strong')}>
        {icon}
      </span>
    );

  return (
    <nav
      aria-label={t('label')}
      className={cn('flex items-center justify-center gap-1', className)}
    >
      {arrow(prev, t('previous'), <ChevronLeft className="size-5" />)}
      <span className="px-3 text-sm font-medium text-muted sm:hidden">
        {t('summary', { page, total: totalPages })}
      </span>
      <ul className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-label={t('page', { page: p })}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  itemClass,
                  p === page
                    ? 'bg-primary text-white hover:bg-primary hover:text-white'
                    : 'text-ink',
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {arrow(next, t('next'), <ChevronRight className="size-5" />)}
    </nav>
  );
}
