import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from '@/components/ui/link';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  /** Link to the queue behind the number ("Review now →"). */
  href?: string;
  actionLabel?: string;
  /** Gold edge: something is waiting for action (e.g. payments to check > 0). */
  highlight?: boolean;
  className?: string;
}

/** A dashboard number that answers "what needs me today?" (DESIGN.md, M7). */
export function StatCard({
  value,
  label,
  icon: Icon,
  href,
  actionLabel,
  highlight,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-card md:p-5',
        highlight && 'border-l-4 border-l-accent',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-heading text-2xl leading-none font-bold text-primary tabular-nums md:text-3xl">
          {value}
        </span>
        {Icon ? (
          <span
            className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary"
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
      <span className="text-sm font-medium text-muted">{label}</span>
      {href && actionLabel ? (
        <Link
          href={href}
          className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-primary hover:underline"
        >
          {actionLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
