import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Feature {
  title: string;
  text: string;
  icon: LucideIcon;
}

/** Icon, short title, one sentence, all centred. Two columns on tablets, four on desktop. */
export function FeatureGrid({ items, columns = 4 }: { items: Feature[]; columns?: 3 | 4 }) {
  return (
    <ul
      className={cn(
        'grid gap-5 sm:grid-cols-2',
        columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {items.map(({ title, text, icon: Icon }) => (
        <li
          key={title}
          className="group flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-7 text-center shadow-card"
        >
          <span
            className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#1f5277] text-white shadow-raised transition group-hover:scale-105"
            aria-hidden
          >
            <Icon className="size-6" />
          </span>
          <h3 className="font-sans text-lg font-semibold">{title}</h3>
          <p className="text-muted">{text}</p>
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
