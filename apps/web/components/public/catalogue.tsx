import { BookOpen, Crown, Gift, SearchX } from 'lucide-react';
import Link from '@/components/ui/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { CatalogueFilters } from '@/components/public/catalogue-filters';
import { CourseList } from '@/components/public/course-list';
import { Button, LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { type PublicCourse, type PublicFilters, publicFetch } from '@/lib/api/public';
import { catalogueHref } from '@/lib/catalogue-url';
import { cn } from '@/lib/cn';

export type CatalogueParams = Record<string, string | string[] | undefined>;
type Kind = 'all' | 'free' | 'premium';

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/** Free means open at once; everything else is a premium (paid) course. */
export const isFreeCourse = (course: Pick<PublicCourse, 'access'>) => course.access === 'FREE';

/** The big switch: all courses, only free ones, or only premium ones. */
function KindSwitch({
  active,
  hrefs,
  counts,
  labels,
  nav,
}: {
  active: Kind;
  hrefs: Record<Kind, string>;
  counts: Record<Kind, number>;
  labels: Record<Kind, string>;
  nav: string;
}) {
  const items: { kind: Kind; icon: ReactNode }[] = [
    { kind: 'all', icon: <BookOpen className="size-4.5" aria-hidden /> },
    { kind: 'free', icon: <Gift className="size-4.5" aria-hidden /> },
    { kind: 'premium', icon: <Crown className="size-4.5" aria-hidden /> },
  ];
  return (
    <nav
      aria-label={nav}
      className="mx-auto flex w-full max-w-md rounded-full border border-border bg-surface p-1.5 shadow-card"
    >
      {items.map(({ kind, icon }) => (
        <Link
          key={kind}
          href={hrefs[kind]}
          scroll={false}
          aria-current={active === kind ? 'true' : undefined}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 font-semibold transition-colors sm:gap-2 sm:px-3',
            active === kind ? 'bg-primary text-white shadow-raised' : 'text-ink hover:text-primary',
          )}
        >
          {icon}
          {labels[kind]}
          <span
            className={cn(
              'hidden rounded-full px-2 text-xs font-bold tabular-nums sm:inline',
              active === kind ? 'bg-white/20 text-white' : 'bg-primary-soft text-primary',
            )}
          >
            {counts[kind]}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function Group({
  icon,
  title,
  text,
  courses,
  basePath,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  courses: PublicCourse[];
  basePath: string;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          {icon}
        </span>
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="max-w-xl text-muted">{text}</p>
      </header>
      <CourseList courses={courses} basePath={basePath} />
    </section>
  );
}

/**
 * The course catalogue: a switch between all, free and premium courses, then language and level
 * filters. With "All", free courses are shown together in one section and premium ones in another.
 * Used on the public Courses page and inside the student area (Browse courses).
 */
export async function CourseCatalogue({
  basePath,
  params,
  signedIn = false,
}: {
  basePath: string;
  params: CatalogueParams;
  /** Students already have an account, so the empty state does not ask them to register. */
  signedIn?: boolean;
}) {
  const t = await getTranslations('courses');
  const filters = await publicFetch<PublicFilters>('/public/filters', {
    languages: [],
    levels: [],
  });
  const language = filters.languages.some((l) => l.code === one(params.language))
    ? one(params.language)
    : '';
  const level = filters.levels.some((l) => l.name === one(params.level)) ? one(params.level) : '';
  const requested = one(params.type);
  const kind: Kind = requested === 'free' || requested === 'premium' ? requested : 'all';

  const query = new URLSearchParams();
  if (language) query.set('language', language);
  if (level) query.set('level', level);
  const { items } = await publicFetch<{ items: PublicCourse[] }>(`/public/courses?${query}`, {
    items: [],
  });
  const free = items.filter(isFreeCourse);
  const premium = items.filter((c) => !isFreeCourse(c));
  const counts: Record<Kind, number> = {
    all: items.length,
    free: free.length,
    premium: premium.length,
  };
  const filtered = Boolean(language || level);
  const href = (lang: string, lvl: string, k: Kind = kind) => catalogueHref(basePath, lang, lvl, k);

  const showFree = kind !== 'premium' && free.length > 0;
  const showPremium = kind !== 'free' && premium.length > 0;

  return (
    <>
      <KindSwitch
        active={kind}
        counts={counts}
        hrefs={{
          all: href(language, level, 'all'),
          free: href(language, level, 'free'),
          premium: href(language, level, 'premium'),
        }}
        labels={{ all: t('kindAll'), free: t('kindFree'), premium: t('kindPremium') }}
        nav={t('kindNav')}
      />

      {filters.languages.length > 0 ? (
        <CatalogueFilters
          basePath={basePath}
          kind={kind}
          language={language}
          level={level}
          languages={filters.languages}
          levels={filters.levels}
        />
      ) : null}

      {showFree || showPremium ? (
        <div className="flex flex-col gap-14 md:gap-20">
          <p className="sr-only" aria-live="polite">
            {t('found', {
              count: (showFree ? free.length : 0) + (showPremium ? premium.length : 0),
            })}
          </p>
          {showFree ? (
            <Group
              icon={<Gift className="size-6" aria-hidden />}
              title={t('freeGroupTitle')}
              text={t('freeGroupText')}
              courses={free}
              basePath={basePath}
            />
          ) : null}
          {showPremium ? (
            <Group
              icon={<Crown className="size-6" aria-hidden />}
              title={t('premiumGroupTitle')}
              text={t('premiumGroupText')}
              courses={premium}
              basePath={basePath}
            />
          ) : null}
        </div>
      ) : filtered || kind !== 'all' ? (
        <EmptyState
          icon={SearchX}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            <Button asChild variant="secondary">
              <Link href={basePath}>{t('clear')}</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={BookOpen}
          title={t('noneTitle')}
          description={t('noneText')}
          action={
            signedIn ? null : <LinkButton href="/register">{t('registerToEnrol')}</LinkButton>
          }
        />
      )}
    </>
  );
}
