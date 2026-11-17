'use client';

import { Pause, Play, Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import type { PublicTestimonial } from '@/lib/api/public';
import { cn } from '@/lib/cn';

/** Seconds each quote spends crossing the screen: slow enough to read, never rushed. */
const SECONDS_PER_QUOTE = 7;

function QuoteCard({ item }: { item: PublicTestimonial }) {
  return (
    <figure className="relative flex h-full w-[18.5rem] shrink-0 flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-surface p-7 shadow-card sm:w-[22rem]">
      <span
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-accent to-transparent"
        aria-hidden
      />
      <Quote className="size-9 text-accent/60" aria-hidden />
      <blockquote className="text-base leading-relaxed text-ink md:text-lg">
        {item.quote}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 border-t border-border pt-4">
        <Avatar name={item.name} size="md" decorative />
        <span className="flex min-w-0 flex-col text-start">
          <span className="truncate font-semibold text-ink">{item.name}</span>
          {item.courseLabel ? (
            <span className="truncate text-sm text-muted">{item.courseLabel}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Student quotes as a slideshow that glides sideways on its own, without anyone scrolling. It starts
 * once the section is on screen, stops while the pointer is over it or focus is inside it, and has a
 * Pause button. For people who asked their device for less motion it stands still and can be scrolled.
 */
export function Testimonials({ items, label }: { items: PublicTestimonial[]; label: string }) {
  const t = useTranslations('home');
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      {
        threshold: 0.2,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Enough cards in each half to fill the screen, so the loop never shows a gap.
  const base = items.slice(0, 9);
  const set = base.length >= 5 ? base : Array.from({ length: 6 }, (_, i) => base[i % base.length]!);
  const duration = Math.max(40, set.length * SECONDS_PER_QUOTE);

  return (
    <div
      ref={root}
      className={cn(
        'flex flex-col items-center gap-6 transition duration-700',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <div
        className="marquee w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]"
        data-run={visible && !paused ? 'true' : 'false'}
        role="region"
        aria-label={label}
        // Focusable so keyboard users can scroll the row when the motion is turned off.
        tabIndex={0}
      >
        <div
          className="marquee-track flex w-max py-2"
          style={{ ['--marquee-duration' as string]: `${duration}s` }}
        >
          <ul className="flex gap-5 pe-5">
            {set.map((item, index) => (
              <li key={`${item.id}-${index}`} className="flex">
                <QuoteCard item={item} />
              </li>
            ))}
          </ul>
          {/* The same quotes again, so the slideshow loops without a break. */}
          <ul className="flex gap-5 pe-5" aria-hidden>
            {set.map((item, index) => (
              <li key={`copy-${item.id}-${index}`} className="flex">
                <QuoteCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? t('sliderPlay') : t('sliderPause')}
        className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface text-primary shadow-card hover:bg-primary-soft"
      >
        {paused ? (
          <Play className="size-5" aria-hidden />
        ) : (
          <Pause className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
