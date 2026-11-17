import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** One styleguide section with an anchor. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-b border-border py-10 first:pt-0 last:border-0 lg:scroll-mt-24"
    >
      <div className="mb-6 flex flex-col gap-2">
        <span className="block h-[3px] w-8 rounded-full bg-accent" aria-hidden />
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        {note ? <p className="max-w-2xl text-muted">{note}</p> : null}
      </div>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

/** A labelled group of examples inside a section. */
export function Demo({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-sans text-sm font-semibold tracking-wider text-muted uppercase">
        {title}
      </h3>
      <div className={cn('rounded-xl border border-border bg-surface p-4 md:p-6', className)}>
        {children}
      </div>
    </div>
  );
}
