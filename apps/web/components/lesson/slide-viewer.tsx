'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { LessonViewSlide } from '@/lib/api/types';

/**
 * A deck of slides, one at a time: big text and picture, arrows, dots, the keyboard's left and right
 * keys, and a swipe on touch screens. Arrow directions flip for right-to-left courses.
 */
export function SlideViewer({ slides, dir }: { slides: LessonViewSlide[]; dir: 'ltr' | 'rtl' }) {
  const t = useTranslations('lessonView');
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  const rtl = dir === 'rtl';
  const slide = slides[index];
  if (!slide) return null;

  const go = (to: number) => setIndex(Math.min(slides.length - 1, Math.max(0, to)));
  // "Next" is to the right in left-to-right text and to the left in right-to-left text.
  const forward = rtl ? -1 : 1;

  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') go(index + forward);
    if (event.key === 'ArrowLeft') go(index - forward);
  }
  function onDown(event: PointerEvent) {
    start.current = event.clientX;
  }
  function onUp(event: PointerEvent) {
    if (start.current === null) return;
    const dx = event.clientX - start.current;
    start.current = null;
    if (Math.abs(dx) < 50) return;
    // Swiping towards the "next" side moves forward.
    go(dx * forward < 0 ? index + 1 : index - 1);
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('slides')}
      onKeyDown={onKey}
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <div
        tabIndex={0}
        onPointerDown={onDown}
        onPointerUp={onUp}
        className="touch-pan-y outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-primary"
        aria-live="polite"
        aria-label={t('slideOf', { n: index + 1, total: slides.length })}
      >
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, authenticated picture
          <img
            src={slide.imageUrl}
            alt=""
            loading="lazy"
            className="aspect-video w-full bg-primary-soft object-cover"
          />
        ) : null}
        <div className="flex min-h-40 flex-col gap-3 p-5 md:p-8">
          <h2 className="text-xl font-bold md:text-2xl">{slide.title}</h2>
          {slide.body ? (
            <p className="text-lg leading-relaxed whitespace-pre-line">{slide.body}</p>
          ) : null}
          {slide.keywords.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-2" aria-label={t('keyWords')}>
              {slide.keywords.map((word) => (
                <li
                  key={word}
                  className="rounded-full bg-accent-soft px-3 py-1.5 font-semibold text-accent-strong"
                >
                  {word}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-canvas px-2 py-1.5">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label={t('previousSlide')}
          className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-primary-soft disabled:opacity-30"
        >
          <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden />
        </button>
        <ol className="flex flex-1 flex-wrap items-center justify-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <li key={s.id}>
              <span
                className={cn(
                  'block h-2 rounded-full transition-all',
                  i === index ? 'w-6 bg-primary' : 'w-2 bg-border-strong',
                )}
              />
            </li>
          ))}
        </ol>
        <span className="min-w-12 text-center text-sm text-muted tabular-nums">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === slides.length - 1}
          aria-label={t('nextSlide')}
          className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-primary-soft disabled:opacity-30"
        >
          <ChevronRight className="size-6 rtl:rotate-180" aria-hidden />
        </button>
      </div>
    </section>
  );
}
