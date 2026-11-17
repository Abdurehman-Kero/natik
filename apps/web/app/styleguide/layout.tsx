import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { appEnv } from '@/lib/site-config';
import { SECTIONS } from './_sections/sections';

// Checked per request: the same build serves staging (visible) and production (404).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Styleguide',
  robots: { index: false, follow: false },
};

/** Design-system reference for review and approval (FR-UI-005). Not available in production. */
export default function StyleguideLayout({ children }: { children: ReactNode }) {
  if (appEnv() === 'production') notFound();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 md:px-6">
          <Logo />
          <span className="ml-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong">
            Styleguide
          </span>
        </div>
        <nav aria-label="Styleguide sections" className="border-t border-border lg:hidden">
          <ul className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 py-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex min-h-9 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-primary hover:bg-primary-soft"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 md:px-6">
        <nav
          aria-label="Styleguide sections"
          className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-48 shrink-0 overflow-y-auto py-8 lg:block"
        >
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex min-h-10 items-center rounded-lg px-3 font-medium text-ink hover:bg-primary-soft hover:text-primary"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
