'use client';

import { ArrowRight, BookOpen, ClipboardCheck, Search, ShieldCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ContactForm } from '@/components/public/contact-form';
import { PlacementCheck } from '@/components/public/placement-check';
import { VerifyForm } from '@/components/public/verify-form';
import type { SiteTool } from '@/components/public/site-tools';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Link from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import type { PublicCourse } from '@/lib/api/public';
import { cn } from '@/lib/cn';
import { searchCourses } from '@/lib/course-search';

/**
 * The four quick dialogs of the public site. They live in their own file so the code behind them
 * (forms, search, the dialog itself) is fetched when someone is about to use one, not with every page.
 */
export default function SiteToolsDialogs({
  tool,
  onOpenChange,
}: {
  tool: SiteTool | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <SearchDialog open={tool === 'search'} onOpenChange={onOpenChange} />
      <MessageDialog open={tool === 'contact'} onOpenChange={onOpenChange} />
      <VerifyDialog open={tool === 'verify'} onOpenChange={onOpenChange} />
      <LevelDialog open={tool === 'level'} onOpenChange={onOpenChange} />
    </>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

let courseCache: PublicCourse[] | null = null;

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('site.search');
  const tn = useTranslations('site.nav');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState<PublicCourse[] | null>(courseCache);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || courseCache) return;
    let live = true;
    api<{ items: PublicCourse[] }>('/public/courses')
      .then((r) => {
        courseCache = r.items;
        if (live) setCourses(r.items);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open]);

  const results = useMemo(() => searchCourses(courses ?? [], query), [courses, query]);
  const shown = query.trim() ? results : results.slice(0, 6);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('');
          setActive(0);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="top-[8%] max-w-xl translate-y-0 p-0 sm:top-[12%]"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            role="combobox"
            aria-expanded
            aria-controls="site-search-results"
            aria-activedescendant={shown[active] ? `site-search-${shown[active].id}` : undefined}
            aria-label={t('title')}
            placeholder={t('placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && shown[active]) {
                e.preventDefault();
                go(`/courses/${shown[active].slug}`);
              }
            }}
            className="h-14 min-w-0 flex-1 bg-transparent pe-10 text-lg outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <div className="max-h-[min(60dvh,28rem)] overflow-y-auto p-2">
          {failed ? (
            <p className="p-6 text-center text-muted">{t('failed')}</p>
          ) : courses === null ? (
            <div className="flex flex-col gap-2 p-2" aria-label={t('loading')}>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="font-semibold">{t('empty', { query: query.trim() })}</p>
              <p className="text-muted">{t('emptyHint')}</p>
              <Link
                href="/courses"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                {t('all')} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              {!query.trim() ? (
                <p className="px-3 pt-1 pb-1 text-xs font-bold tracking-wider text-muted uppercase">
                  {t('popular')}
                </p>
              ) : null}
              <ul id="site-search-results" ref={listRef} role="listbox" className="flex flex-col">
                {shown.map((course, index) => (
                  <li key={course.id} role="presentation">
                    <Link
                      id={`site-search-${course.id}`}
                      role="option"
                      aria-selected={index === active}
                      href={`/courses/${course.slug}`}
                      onClick={() => onOpenChange(false)}
                      onMouseEnter={() => setActive(index)}
                      tabIndex={-1}
                      className={cn(
                        'flex min-h-16 items-center gap-3 rounded-xl p-2 transition-colors',
                        index === active ? 'bg-primary-soft' : 'hover:bg-canvas',
                      )}
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-primary-soft">
                        {course.imageUrl ? (
                          <Image
                            src={course.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <BookOpen className="m-3 size-6 text-primary" aria-hidden />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold text-ink">{course.title}</span>
                        <span className="truncate text-sm text-muted">
                          {course.language.name} · {course.level.name}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold',
                          course.access === 'FREE'
                            ? 'bg-success-soft text-success'
                            : 'bg-accent-soft text-accent-strong',
                        )}
                      >
                        {course.access === 'FREE' ? t('free') : t('premium')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 border-t border-border bg-canvas px-3 py-1 text-sm">
          <button
            type="button"
            onClick={() => go('/find-your-level')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
          >
            <ClipboardCheck className="size-4" aria-hidden /> {tn('level')}
          </button>
          <button
            type="button"
            onClick={() => go('/teachers')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
          >
            <Users className="size-4" aria-hidden /> {tn('teachers')}
          </button>
          <span className="ms-auto hidden text-muted md:inline">{t('tip')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Message the team, verify a certificate, find your level ─────────────────────────────────────

function MessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('site.message');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('text')}</DialogDescription>
        <div className="mt-5">{open ? <ContactForm embedded /> : null}</div>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('verify');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <DialogTitle className="leading-tight">{t('title')}</DialogTitle>
        </div>
        <DialogDescription>{t('how')}</DialogDescription>
        <div className="mt-5">{open ? <VerifyForm /> : null}</div>
      </DialogContent>
    </Dialog>
  );
}

type PlacementLanguage = { name: string; code: string; direction: 'LTR' | 'RTL' };

function LevelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('placement');
  const [languages, setLanguages] = useState<PlacementLanguage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || languages) return;
    let live = true;
    api<{ items: PlacementLanguage[] }>('/public/placement')
      .then((r) => live && setLanguages(r.items))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, languages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('subtitle')}</DialogDescription>
        <div className="mt-5">
          {failed || (languages && languages.length === 0) ? (
            <p className="text-center text-muted">{t('unavailableText')}</p>
          ) : languages ? (
            <PlacementCheck languages={languages} embedded />
          ) : (
            <Skeleton className="h-40" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
