import { BookOpen, Info, UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { CourseCarousel } from '@/components/public/course-carousel';
import {
  CourseContent,
  CourseInstructor,
  CourseOverview,
  CourseSidebar,
} from '@/components/public/course-detail';
import { CourseTabs } from '@/components/public/course-tabs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { CourseCard } from '@/components/ui/course-card';
import { Container } from '@/components/ui/layout';
import { formatPrice } from '@natik/shared';
import type { PublicCourse, PublicCourseDetail } from '@/lib/api/public';
import { contentLang } from '@/lib/script';
import { siteUrl } from '@/lib/site-config';

/** Other courses in the same language first, then the rest, to keep visitors browsing. */
export function pickSimilar(all: PublicCourse[], course: PublicCourseDetail): PublicCourse[] {
  const others = all.filter((c) => c.id !== course.id);
  return [
    ...others.filter((c) => c.language.code === course.language.code),
    ...others.filter((c) => c.language.code !== course.language.code),
  ].slice(0, 8);
}

/**
 * One course page: the card with the picture, price and button on the left; the title, the teacher
 * and the Overview / Content / Instructor tabs on the right; similar courses below. Shared by the
 * public site (`/courses/...`) and the student area (`/browse/...`), which only differ in where the links go.
 */
export async function CourseView({
  course,
  similar,
  basePath,
  embedded = false,
}: {
  course: PublicCourseDetail;
  similar: PublicCourse[];
  basePath: '/courses' | '/browse';
  /** Inside the student area, which already has its own frame. */
  embedded?: boolean;
}) {
  const t = await getTranslations('courses');
  const tn = await getTranslations('site.nav');
  const titleTag = contentLang(course.title);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.summary,
    inLanguage: course.language.code,
    provider: { '@type': 'EducationalOrganization', name: 'Natik Language Centre', url: siteUrl() },
  };

  const teacherNames = course.teachers.map((teacher) => teacher.name);
  const grid = (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-10">
      <CourseSidebar course={course} />
      <div className="flex min-w-0 flex-col gap-5">
        <Breadcrumb
          label={tn('breadcrumb')}
          items={[
            { label: t('title'), href: basePath },
            {
              label: course.language.name,
              href: `${basePath}?language=${encodeURIComponent(course.language.code)}`,
            },
            { label: course.title },
          ]}
        />
        <div className="flex flex-col gap-3">
          <h1
            {...titleTag}
            className={`text-[1.75rem] leading-[1.2] font-bold md:text-4xl ${titleTag.dir ? 'text-right' : ''}`}
          >
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{course.language.name}</Badge>
            <Badge tone="primary">{course.level.name}</Badge>
            {course.durationText ? <Badge tone="muted">{course.durationText}</Badge> : null}
          </div>
          {teacherNames.length > 0 ? (
            <div className="flex items-center gap-3">
              <Avatar name={teacherNames[0]!} size="md" decorative />
              <div className="leading-tight">
                <p className="font-semibold">{teacherNames.join(', ')}</p>
                <p className="text-sm text-muted">
                  {teacherNames.length > 1 ? t('teachersTitle') : t('instructorTitle')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <CourseTabs
          label={t('title')}
          tabs={[
            {
              id: 'overview',
              label: t('tabOverview'),
              icon: <Info aria-hidden />,
              content: <CourseOverview course={course} />,
            },
            {
              id: 'content',
              label: t('tabContent'),
              icon: <BookOpen aria-hidden />,
              content: <CourseContent course={course} />,
            },
            {
              id: 'instructor',
              label: t('tabInstructor'),
              icon: <UserRound aria-hidden />,
              content: <CourseInstructor course={course} />,
            },
          ]}
        />
      </div>
    </div>
  );
  const carousel =
    similar.length > 0 ? (
      <CourseCarousel title={t('similarTitle')}>
        {similar.map((c) => (
          <li key={c.id} className="flex w-[78%] shrink-0 snap-start sm:w-[22rem]">
            <CourseCard
              className="w-full"
              href={`${basePath}/${c.slug}`}
              title={c.title}
              imageUrl={c.imageUrl}
              titleLang={contentLang(c.title).lang}
              language={c.language.name}
              level={c.level.name}
              duration={c.durationText}
              priceLabel={
                c.access === 'PAID' && c.priceSantim === null
                  ? t('priceOnRequest')
                  : formatPrice(c.access, c.priceSantim, t('free'))
              }
              isFree={c.access === 'FREE'}
            />
          </li>
        ))}
      </CourseCarousel>
    ) : null;

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-built data (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {embedded ? (
        <div className="flex flex-col gap-10">
          {grid}
          {carousel}
        </div>
      ) : (
        <>
          <section className="bg-linear-to-b from-primary-soft/60 to-canvas py-6 md:py-10">
            <Container>{grid}</Container>
          </section>
          {carousel ? (
            <section className="bg-surface py-10 md:py-14">
              <Container>{carousel}</Container>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
