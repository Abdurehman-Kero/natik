'use client';

import { formatPrice } from '@natik/shared';
import { BookOpen, Crown, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { AuthButton } from '@/components/auth/auth-button';
import { Button, LinkButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import Link from '@/components/ui/link';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { PublicCourse } from '@/lib/api/public';
import { cn } from '@/lib/cn';
import { searchCourses } from '@/lib/course-search';
import { contentLang } from '@/lib/script';

export type Kind = 'all' | 'free' | 'premium';

export interface BrowserState {
  q: string;
  kind: Kind;
  languages: string[];
  levels: string[];
  min: string;
  max: string;
}

const PRICE_PRESETS: { min: number; max: number | null }[] = [
  { min: 0, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: 1500 },
  { min: 1500, max: 3000 },
  { min: 3000, max: null },
];

const isFree = (c: PublicCourse) => c.access === 'FREE';
/** Price in birr; free is 0; a premium course with no public price is unknown (null). */
const priceOf = (c: PublicCourse): number | null =>
  isFree(c) ? 0 : c.priceSantim === null ? null : c.priceSantim / 100;

function applyFilters(courses: PublicCourse[], s: BrowserState, ignoreKind = false) {
  const min = s.min === '' ? null : Number(s.min);
  const max = s.max === '' ? null : Number(s.max);
  let result = searchCourses(courses, s.q);
  if (s.languages.length > 0) result = result.filter((c) => s.languages.includes(c.language.code));
  if (s.levels.length > 0) result = result.filter((c) => s.levels.includes(c.level.name));
  if (!ignoreKind && s.kind !== 'all')
    result = result.filter((c) => (s.kind === 'free' ? isFree(c) : !isFree(c)));
  if (min !== null || max !== null) {
    result = result.filter((c) => {
      const price = priceOf(c);
      if (price === null) return false;
      return (min === null || price >= min) && (max === null || price <= max);
    });
  }
  return result;
}

/** One group of check boxes in the filter column: a title, then each choice with how many courses. */
function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1 border-b border-border pb-4 last:border-0">
      <legend className="mb-2 text-sm font-bold tracking-wider text-muted uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FilterPanel({
  state,
  set,
  languages,
  levels,
  courses,
}: {
  state: BrowserState;
  set: (patch: Partial<BrowserState>) => void;
  languages: { code: string; name: string }[];
  levels: { id: string; name: string }[];
  courses: PublicCourse[];
}) {
  const t = useTranslations('courses');
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  // Counts show what ticking a box would leave, given the other choices.
  const countLanguage = (code: string) =>
    applyFilters(courses, { ...state, languages: [code] }).length;
  const countLevel = (name: string) => applyFilters(courses, { ...state, levels: [name] }).length;
  const minId = useId();
  const maxId = useId();

  return (
    <div className="flex flex-col gap-4">
      <FilterGroup title={t('language')}>
        {languages.map((l) => (
          <Checkbox
            key={l.code}
            checked={state.languages.includes(l.code)}
            onCheckedChange={() => set({ languages: toggle(state.languages, l.code) })}
            className="min-h-10 justify-center"
            label={
              <span className="flex w-full items-center justify-between gap-2">
                <span>{l.name}</span>
                <span className="text-sm text-muted tabular-nums">{countLanguage(l.code)}</span>
              </span>
            }
          />
        ))}
      </FilterGroup>
      <FilterGroup title={t('level')}>
        {levels.map((l) => (
          <Checkbox
            key={l.id}
            checked={state.levels.includes(l.name)}
            onCheckedChange={() => set({ levels: toggle(state.levels, l.name) })}
            className="min-h-10 justify-center"
            label={
              <span className="flex w-full items-center justify-between gap-2">
                <span>{l.name}</span>
                <span className="text-sm text-muted tabular-nums">{countLevel(l.name)}</span>
              </span>
            }
          />
        ))}
      </FilterGroup>
      <FilterGroup title={t('priceFilter')}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={minId} className="sr-only">
              {t('priceMin')}
            </label>
            <input
              id={minId}
              inputMode="numeric"
              placeholder={t('priceMin')}
              value={state.min}
              onChange={(e) => set({ min: e.target.value.replace(/\D/g, '') })}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base"
            />
          </div>
          <div>
            <label htmlFor={maxId} className="sr-only">
              {t('priceMax')}
            </label>
            <input
              id={maxId}
              inputMode="numeric"
              placeholder={t('priceMax')}
              value={state.max}
              onChange={(e) => set({ max: e.target.value.replace(/\D/g, '') })}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base"
            />
          </div>
        </div>
        <div role="group" aria-label={t('priceFilter')} className="mt-2 flex flex-col gap-1.5">
          {PRICE_PRESETS.map((p) => {
            const active =
              state.min === String(p.min) && state.max === (p.max ? String(p.max) : '');
            return (
              <button
                key={p.min}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set(
                    active
                      ? { min: '', max: '' }
                      : { min: String(p.min), max: p.max ? String(p.max) : '' },
                  )
                }
                className={cn(
                  'min-h-11 rounded-lg border px-3 text-start text-[0.9375rem] transition-colors',
                  active
                    ? 'border-primary bg-primary-soft font-semibold text-primary'
                    : 'border-border bg-surface hover:border-primary',
                )}
              >
                {p.max === null
                  ? t('priceOver', { min: p.min.toLocaleString('en-US') })
                  : p.min === 0
                    ? t('priceUnder', { max: p.max.toLocaleString('en-US') })
                    : t('priceBetween', {
                        min: p.min.toLocaleString('en-US'),
                        max: p.max.toLocaleString('en-US'),
                      })}
              </button>
            );
          })}
        </div>
      </FilterGroup>
    </div>
  );
}

/** One course as a row: picture, title, price, level bar and one button (like a shop list). */
function CourseRow({
  course,
  href,
  levelIndex,
  levelCount,
  first,
}: {
  course: PublicCourse;
  href: string;
  levelIndex: number;
  levelCount: number;
  first: boolean;
}) {
  const t = useTranslations('courses');
  const free = isFree(course);
  const price =
    course.access === 'PAID' && course.priceSantim === null
      ? t('priceOnRequest')
      : formatPrice(course.access, course.priceSantim, t('free'));
  const progress = levelCount > 0 ? Math.round(((levelIndex + 1) / levelCount) * 100) : 0;
  const lang = contentLang(course.title);
  return (
    <li className="flex card-hover flex-col gap-4 rounded-2xl border border-border bg-surface p-3 shadow-card sm:flex-row sm:p-4">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-primary sm:w-60 lg:w-64"
      >
        {course.imageUrl ? (
          <Image
            src={course.imageUrl}
            alt=""
            fill
            priority={first}
            sizes="(min-width: 1024px) 256px, (min-width: 640px) 240px, 100vw"
            quality={60}
            className="card-hover-image object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-linear-to-br from-primary to-[#1f5277]">
            <BookOpen className="size-10 text-white/60" aria-hidden />
          </span>
        )}
        <span
          className={cn(
            'absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold shadow-card',
            free ? 'bg-success-soft text-success' : 'bg-primary text-white',
          )}
        >
          {free ? null : <Crown className="size-3.5 text-accent" aria-hidden />}
          {free ? t('kindFree') : t('kindPremium')}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
        <h3 lang={lang.lang} className="text-lg leading-snug font-bold">
          <Link href={href} className="hover:text-primary hover:underline">
            {course.title}
          </Link>
        </h3>
        <p className={cn('font-heading text-xl font-bold', free ? 'text-success' : 'text-primary')}>
          {price}
        </p>
        <p className="text-sm text-muted">
          {[course.language.name, course.durationText].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">
            {t('levelLabel', { level: course.level.name })}
          </p>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-primary-soft" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <LinkButton href={href} variant="secondary" className="mt-1 w-full sm:max-w-xs">
          {t('viewCourse')}
        </LinkButton>
      </div>
    </li>
  );
}

/**
 * The course list as a shop: filters on the left (a drawer on phones), a search box and the
 * All / Free / Premium tabs on top, and one row per course. Everything filters at once in the
 * browser; the choices are kept in the address so a filtered list can be shared.
 */
export function CourseBrowser({
  courses,
  languages,
  levels,
  basePath,
  initial,
  signedIn,
}: {
  courses: PublicCourse[];
  languages: { code: string; name: string }[];
  levels: { id: string; name: string }[];
  basePath: string;
  initial: BrowserState;
  signedIn: boolean;
}) {
  const t = useTranslations('courses');
  const [state, setState] = useState<BrowserState>(initial);
  const set = (patch: Partial<BrowserState>) => setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    const params = new URLSearchParams();
    if (state.kind !== 'all') params.set('type', state.kind);
    if (state.languages.length) params.set('language', state.languages.join(','));
    if (state.levels.length) params.set('level', state.levels.join(','));
    if (state.q.trim()) params.set('q', state.q.trim());
    if (state.min) params.set('min', state.min);
    if (state.max) params.set('max', state.max);
    const text = params.toString();
    window.history.replaceState(window.history.state, '', text ? `${basePath}?${text}` : basePath);
  }, [state, basePath]);

  const shown = useMemo(() => applyFilters(courses, state), [courses, state]);
  const counts = useMemo(() => {
    const base = applyFilters(courses, state, true);
    return {
      all: base.length,
      free: base.filter(isFree).length,
      premium: base.filter((c) => !isFree(c)).length,
    };
  }, [courses, state]);
  const activeCount =
    state.languages.length + state.levels.length + (state.min || state.max ? 1 : 0);
  const filtered = activeCount > 0 || state.q.trim() !== '' || state.kind !== 'all';
  const clear = () => setState({ q: '', kind: 'all', languages: [], levels: [], min: '', max: '' });
  const levelIndex = (name: string) => levels.findIndex((l) => l.name === name);

  const tabs: { kind: Kind; label: string }[] = [
    { kind: 'all', label: t('kindAll') },
    { kind: 'free', label: t('kindFree') },
    { kind: 'premium', label: t('kindPremium') },
  ];

  const panel = (
    <FilterPanel state={state} set={set} languages={languages} levels={levels} courses={courses} />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <aside aria-label={t('filters')} className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('filters')}</h2>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => set({ languages: [], levels: [], min: '', max: '' })}
                className="min-h-11 text-sm font-semibold text-primary hover:underline"
              >
                {t('clearFilters')}
              </button>
            ) : null}
          </div>
          {panel}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={state.q}
              onChange={(e) => set({ q: e.target.value })}
              aria-label={t('searchCourses')}
              placeholder={t('searchCourses')}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface ps-11 pe-4 text-base transition-colors placeholder:text-muted/80 hover:border-ink/60 focus-visible:border-primary"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" className="h-12 shrink-0 lg:hidden">
                <SlidersHorizontal aria-hidden />
                {t('filters')}
                {activeCount > 0 ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[88dvh]">
              <SheetTitle className="px-5 pt-5 text-xl font-bold">{t('filtersTitle')}</SheetTitle>
              <div className="flex-1 overflow-y-auto px-5 py-4">{panel}</div>
              <div className="flex gap-2 border-t border-border p-4">
                {activeCount > 0 ? (
                  <Button
                    variant="ghost"
                    onClick={() => set({ languages: [], levels: [], min: '', max: '' })}
                  >
                    <X aria-hidden /> {t('clearFilters')}
                  </Button>
                ) : null}
                <SheetClose asChild>
                  <Button className="flex-1">{t('showResults', { count: shown.length })}</Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label={t('kindNav')}
            className="flex w-full gap-1 rounded-full border border-border bg-surface p-1 sm:w-auto"
          >
            {tabs.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                aria-pressed={state.kind === tab.kind}
                onClick={() => set({ kind: tab.kind })}
                className={cn(
                  'flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1.5 text-[0.9375rem] font-semibold transition-colors sm:flex-none sm:gap-2 sm:px-4 sm:text-base',
                  state.kind === tab.kind
                    ? 'bg-primary text-white shadow-raised'
                    : 'text-ink hover:text-primary',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'hidden rounded-full px-2 text-xs font-bold tabular-nums min-[400px]:inline',
                    state.kind === tab.kind
                      ? 'bg-white/20 text-white'
                      : 'bg-primary-soft text-primary',
                  )}
                >
                  {counts[tab.kind]}
                </span>
              </button>
            ))}
          </nav>
          <p className="text-muted" aria-live="polite">
            {t('found', { count: shown.length })}
          </p>
        </div>

        {shown.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {shown.map((course, index) => (
              <CourseRow
                key={course.id}
                // The first pictures are what the visitor sees first: load them at once, not lazily.
                first={index < 2}
                course={course}
                href={`${basePath}/${course.slug}`}
                levelIndex={levelIndex(course.level.name)}
                levelCount={levels.length}
              />
            ))}
          </ul>
        ) : filtered ? (
          <EmptyState
            icon={SearchX}
            title={t('emptyTitle')}
            description={t('emptyText')}
            action={
              <Button variant="secondary" onClick={clear}>
                {t('clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title={t('noneTitle')}
            description={t('noneText')}
            action={
              signedIn ? null : <AuthButton mode="register">{t('registerToEnrol')}</AuthButton>
            }
          />
        )}
      </div>
    </div>
  );
}
