import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from '@/components/ui/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CourseBody, CourseSidebar } from '@/components/public/course-detail';
import { CourseList } from '@/components/public/course-list';
import { PublicSection } from '@/components/public/section';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/layout';
import { type PublicCourse, type PublicCourseDetail, publicFetch } from '@/lib/api/public';
import { contentLang } from '@/lib/script';
import { siteUrl } from '@/lib/site-config';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PublicCourseDetail | null> {
  return publicFetch<PublicCourseDetail | null>(
    `/public/courses/${encodeURIComponent(slug)}`,
    null,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await load((await params).slug);
  if (!course) return {};
  return { title: course.title, description: course.summary };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const course = await load(slug);
  if (!course) notFound();

  const t = await getTranslations('courses');
  const titleTag = contentLang(course.title);

  // Other courses in the same language, to keep visitors browsing.
  const { items: sameLanguage } = await publicFetch<{ items: PublicCourse[] }>(
    `/public/courses?language=${encodeURIComponent(course.language.code)}`,
    { items: [] },
  );
  const related = sameLanguage.filter((c) => c.id !== course.id).slice(0, 3);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.summary,
    inLanguage: course.language.code,
    provider: { '@type': 'EducationalOrganization', name: 'Natik Language Centre', url: siteUrl() },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-built data (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="on-dark relative overflow-hidden bg-linear-to-br from-primary via-primary to-[#0b2a42] text-white">
        <Container className="flex flex-col gap-4 py-8 md:py-12">
          <Link
            href="/courses"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-white/85 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('backToCourses')}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{course.language.name}</Badge>
            <Badge tone="primary">{course.level.name}</Badge>
          </div>
          <h1
            {...titleTag}
            className={`max-w-3xl text-[1.75rem] leading-[1.2] font-bold text-white md:text-4xl ${titleTag.dir ? 'text-right' : ''}`}
          >
            {course.title}
          </h1>
          <p className="max-w-2xl text-lg text-white/85">{course.summary}</p>
        </Container>
      </section>

      <PublicSection className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <CourseBody course={course} />

        <CourseSidebar course={course} />
      </PublicSection>

      {related.length > 0 ? (
        <PublicSection tone="white" title={t('relatedTitle')}>
          <CourseList courses={related} />
        </PublicSection>
      ) : null}
    </>
  );
}
