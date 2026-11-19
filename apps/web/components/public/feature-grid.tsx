import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Feature {
  title: string;
  text: string;
  icon: LucideIcon;
}

/**
 * Why Natik: cards with a soft icon tile, a short title and one sentence. The tiles alternate between
 * navy and gold tints. One column on phones, two on tablets, three (or four) on desktop.
 */
export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 3 | 4 }) {
  return (
    <ul
      className={cn(
        'grid gap-4 sm:grid-cols-2 md:gap-5',
        columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {items.map(({ title, text, icon: Icon }, index) => (
        <li
          key={title}
          className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-raised md:p-7"
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
              index % 2 === 0
                ? 'bg-primary-soft text-primary'
                : 'bg-accent-soft text-accent-strong',
            )}
            aria-hidden
          >
            <Icon className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-sans text-lg font-bold">{title}</h3>
            <p className="text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface Step {
  title: string;
  text: string;
}

/** Numbered steps joined by a line on larger screens, centred, stacked on phones. */
export function Steps({ items }: { items: Step[] }) {
  return (
    <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
      <span
        className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-border-strong to-transparent md:block"
        aria-hidden
      />
      {items.map((item, index) => (
        <li key={item.title} className="relative flex flex-col items-center gap-3 text-center">
          <span
            className="relative flex size-14 items-center justify-center rounded-full bg-primary font-heading text-xl font-bold text-white shadow-raised ring-8 ring-canvas"
            aria-hidden
          >
            {index + 1}
          </span>
          <h3 className="font-sans text-lg font-semibold">{item.title}</h3>
          <p className="max-w-xs text-muted">{item.text}</p>
        </li>
      ))}
    </ol>
  );
}
