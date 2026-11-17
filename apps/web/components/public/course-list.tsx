import { formatPrice } from '@natik/shared';
import { getTranslations } from 'next-intl/server';
import { CourseCard } from '@/components/ui/course-card';
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
