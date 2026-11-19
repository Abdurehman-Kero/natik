'use client';

import { ChevronLeft, ChevronRight, Pause, Play, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Avatar } from '@/components/ui/avatar';
import type { PublicTestimonial } from '@/lib/api/public';
import { cn } from '@/lib/cn';

/** Seconds each quote stays: long enough to read it, never rushed. */
const SECONDS_PER_QUOTE = 8;

/**
 * Student quotes, one at a time on a big calm card: five gold stars, the words, and the student's
 * photo (or initials), name and course. It moves on by itself once the section is on screen, stops
 * while the pointer or keyboard focus is inside, and has Previous, Next, dots and a Pause button.
 * For people who asked their device for less motion it never moves on its own.
 */
export function Testimonials({ items, label }: { items: PublicTestimonial[]; label: string }) {
  const t = useTranslations('home');
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inside, setInside] = useState(false);
  const [index, setIndex] = useState(0);
  // People who asked their device for less motion are never moved on automatically.
  const reduced = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const count = items.length;
  const current = items[index % count]!;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const running = visible && !paused && !inside && !reduced && count > 1;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), SECONDS_PER_QUOTE * 1000);
    return () => window.clearInterval(id);
  }, [running, count, index]);

  const go = (to: number) => setIndex(((to % count) + count) % count);
  const arrow =
    'flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface text-primary shadow-card transition-colors hover:bg-primary-soft';

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setInside(true)}
      onMouseLeave={() => setInside(false)}
      onFocus={() => setInside(true)}
      onBlur={() => setInside(false)}
      data-run={running ? 'true' : 'false'}
      className={cn(
        'mx-auto flex max-w-3xl flex-col items-center gap-6 transition duration-700',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <figure
        key={current.id}
        aria-live={running ? 'off' : 'polite'}
        className="relative w-full animate-fade-in overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card md:p-10"
      >
        <span
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-accent to-transparent"
          aria-hidden
        />
        <div className="flex gap-1 text-accent" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className="size-5 fill-current" />
          ))}
        </div>
        <blockquote className="mt-4 text-lg leading-relaxed text-ink md:text-2xl md:leading-relaxed">
          “{current.quote}”
        </blockquote>
        <figcaption className="mt-6 flex items-center gap-4">
          <Avatar
            name={current.name}
            src={current.photoUrl}
            size="lg"
            decorative
            className="ring-2 ring-accent/40"
          />
          <span className="flex min-w-0 flex-col text-start">
            <span className="truncate text-lg font-bold text-ink">{current.name}</span>
            {current.courseLabel ? (
              <span className="truncate text-muted">{current.courseLabel}</span>
            ) : null}
          </span>
        </figcaption>
      </figure>

      {count > 1 ? (
        // On a phone the three buttons sit in one row and the dots (up to a dozen) in a row under them;
        // from small tablets up everything is on one line.
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t('sliderPrev')}
            className={arrow}
          >
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
          </button>
          <ul className="order-last flex w-full flex-wrap items-center justify-center sm:order-none sm:w-auto">
            {items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t('sliderDot', { n: i + 1, total: count })}
                  aria-current={i === index % count ? 'true' : undefined}
                  className="flex size-8 items-center justify-center"
                >
                  <span
                    className={cn(
                      'h-2.5 rounded-full transition-all',
                      i === index % count ? 'w-6 bg-accent' : 'w-2.5 bg-border-strong',
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t('sliderNext')}
            className={arrow}
          >
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t('sliderPlay') : t('sliderPause')}
            className={arrow}
          >
            {paused ? (
              <Play className="size-5" aria-hidden />
            ) : (
              <Pause className="size-5" aria-hidden />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
