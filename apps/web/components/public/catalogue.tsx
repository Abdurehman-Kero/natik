import { CourseBrowser, type Kind } from '@/components/public/course-browser';
import { type PublicCourse, type PublicFilters, publicFetch } from '@/lib/api/public';

export type CatalogueParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const list = (value: string | string[] | undefined) =>
  one(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
const digits = (value: string | string[] | undefined) => one(value).replace(/\D/g, '').slice(0, 7);

/** Free means open at once; everything else is a premium (paid) course. */
export const isFreeCourse = (course: Pick<PublicCourse, 'access'>) => course.access === 'FREE';

/**
 * The course catalogue as a shop (filters, search, All / Free / Premium and a row per course).
 * Used on the public Courses page and inside the student area (Browse courses). The first choices
 * come from the address (`?language=ar&type=free`), so shared and old links keep working.
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
  const [filters, { items }] = await Promise.all([
    publicFetch<PublicFilters>('/public/filters', { languages: [], levels: [] }),
    publicFetch<{ items: PublicCourse[] }>('/public/courses', { items: [] }),
  ]);
  const requested = one(params.type);
  const kind: Kind = requested === 'free' || requested === 'premium' ? requested : 'all';

  return (
    <CourseBrowser
      courses={items}
      languages={filters.languages}
      levels={filters.levels}
      basePath={basePath}
      signedIn={signedIn}
      initial={{
        q: one(params.q).slice(0, 80),
        kind,
        languages: list(params.language).filter((code) =>
          filters.languages.some((l) => l.code === code),
        ),
        levels: list(params.level).filter((name) => filters.levels.some((l) => l.name === name)),
        min: digits(params.min),
        max: digits(params.max),
      }}
    />
  );
}
