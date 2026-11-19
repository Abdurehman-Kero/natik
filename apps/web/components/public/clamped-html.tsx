'use client';

import { useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Long course text folded to a few lines, with "Show more" only when it is really long. */
export function ClampedHtml({
  html,
  lang,
  dir,
}: {
  html: string;
  lang?: string;
  dir?: 'rtl' | 'ltr';
}) {
  const t = useTranslations('courses');
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > 200);
  }, [html]);

  return (
    <div>
      <div
        ref={ref}
        lang={lang}
        dir={dir}
        className={cn('lesson-prose relative overflow-hidden', long && !open && 'max-h-44')}
        // Safe: the API builds this HTML from an allow-list of tags (rich-text.ts).
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 min-h-11 text-sm font-semibold text-primary hover:underline"
        >
          {open ? t('showLess') : t('showMore')}
        </button>
      ) : null}
    </div>
  );
}
