import { formatPrice } from '@natik/shared';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Avatar } from '@/components/ui/avatar';
import { CourseCard } from '@/components/ui/course-card';
import Link from '@/components/ui/link';
import type { PublicCourse } from '@/lib/api/public';
import { cn } from '@/lib/cn';
import { contentLang } from '@/lib/script';

/** A responsive grid of course cards: one column on phones, two on tablets, three on desktop. */
export async function CourseList({
  courses,
  swipe = false,
  basePath = '/courses',
}: {
  courses: PublicCourse[];
  /** On phones, show cards in one swipeable row instead of a tall stack. */
  swipe?: boolean;
  /** Where a card leads: the public course pages, or the student area's own. */
  basePath?: string;
}) {
  const t = await getTranslations('courses');
  return (
    <ul
      className={cn(
        swipe
          ? '-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3'
          : 'flex flex-wrap justify-center gap-6',
      )}
    >
      {courses.map((course) => (
        <li
          key={course.id}
          className={cn(
            'flex',
            swipe
              ? 'w-[82%] shrink-0 snap-start sm:w-auto'
              : 'w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]',
          )}
        >
          <CourseCard
            className="w-full"
            href={`${basePath}/${course.slug}`}
            title={course.title}
            imageUrl={course.imageUrl}
            titleLang={contentLang(course.title).lang}
            language={course.language.name}
            level={course.level.name}
            duration={course.durationText}
            priceLabel={
              course.access === 'PAID' && course.priceSantim === null
                ? t('priceOnRequest')
                : formatPrice(course.access, course.priceSantim, t('free'))
            }
            isFree={course.access === 'FREE'}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Small cards for the home page: picture, two-line title, price, level and one button. On phones
 * they sit in a swipeable row; from tablets up they form a grid of up to four.
 */
export async function CompactCourseList({
  courses,
  basePath = '/courses',
}: {
  courses: PublicCourse[];
  basePath?: string;
}) {
  const t = await getTranslations('courses');
  return (
    <ul className="-mx-1 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
      {courses.map((course) => {
        const free = course.access === 'FREE';
        const price =
          course.access === 'PAID' && course.priceSantim === null
            ? t('priceOnRequest')
            : formatPrice(course.access, course.priceSantim, t('free'));
        return (
          <li key={course.id} className="flex w-[72%] shrink-0 snap-start sm:w-auto">
            <Link
              href={`${basePath}/${course.slug}`}
              className="group flex w-full card-hover flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <span className="relative block aspect-[16/10] bg-primary">
                {course.imageUrl ? (
                  <Image
                    src={course.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 72vw"
                    quality={60}
                    className="card-hover-image object-cover"
                  />
                ) : null}
              </span>
              <span className="flex flex-1 flex-col gap-2 p-3.5">
                <span
                  lang={contentLang(course.title).lang}
                  className="line-clamp-2 min-h-[2.6rem] text-[0.9375rem] leading-snug font-bold"
                >
                  {course.title}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'font-heading text-base font-bold',
                      free ? 'text-success' : 'text-primary',
                    )}
                  >
                    {price}
                  </span>
                  <span className="truncate text-xs text-muted">{course.level.name}</span>
                </span>
                <span className="mt-auto flex min-h-10 items-center justify-center rounded-lg border border-primary text-sm font-semibold text-primary transition-colors group-hover:bg-primary-soft">
                  {t('viewCourse')}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The teachers tab of the same section: a photo (or initials), the name and a short line. */
export function TeacherMiniList({
  teachers,
}: {
  teachers: { id: string; name: string; bio: string | null; photoUrl: string | null }[];
}) {
  return (
    <ul className="-mx-1 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
      {teachers.map((teacher) => (
        <li key={teacher.id} className="flex w-[72%] shrink-0 snap-start sm:w-auto">
          <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-center shadow-card">
            <Avatar name={teacher.name} src={teacher.photoUrl} size="lg" />
            <p className="font-bold">{teacher.name}</p>
            {teacher.bio ? <p className="line-clamp-3 text-sm text-muted">{teacher.bio}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
