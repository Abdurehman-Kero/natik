'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useRef } from 'react';

/** A row of cards that scrolls sideways, with arrows on larger screens. */
export function CourseCarousel({ children, title }: { children: ReactNode; title: string }) {
  const t = useTranslations('courses');
  const ref = useRef<HTMLUListElement>(null);
  const move = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  const arrow =
    'hidden size-10 items-center justify-center rounded-full border border-border bg-surface shadow-card transition hover:border-primary hover:text-primary md:flex';
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={t('previous')}
            className={arrow}
          >
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('next')} className={arrow}>
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      </div>
      <ul
        ref={ref}
        className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </div>
  );
}
