import { ChevronRight } from 'lucide-react';
import Link from '@/components/ui/link';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

/** Where am I? The last item is the current page. */
export function Breadcrumb({
  items,
  label = 'Breadcrumb',
  className,
}: {
  items: Crumb[];
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="rounded hover:text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(last && 'font-medium text-ink')}
                >
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight className="size-4" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
