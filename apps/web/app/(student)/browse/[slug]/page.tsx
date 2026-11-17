import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CourseBody, CourseSidebar } from '@/components/public/course-detail';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/layout';
import { type PublicCourseDetail, publicFetch } from '@/lib/api/public';
import { requireRole } from '@/lib/auth';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return publicFetch<PublicCourseDetail | null>(
    `/public/courses/${encodeURIComponent(slug)}`,
    null,
  );
}

export async function generateMetadata({ params }: Props) {
  const course = await load((await params).slug);
  return course ? { title: course.title } : {};
}

/** One course inside the student area: read about it, then enrol or continue, without leaving the dashboard. */
export default async function BrowseCoursePage({ params }: Props) {
  const { slug } = await params;
  await requireRole(['STUDENT'], `/browse/${slug}`);
  const course = await load(slug);
  if (!course) notFound();
  const t = await getTranslations('courses');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/browse', label: t('backToCourses') }}
        title={course.title}
        subtitle={course.summary}
        className="pb-0 [&_h1]:text-start"
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">{course.language.name}</Badge>
        <Badge tone="primary">{course.level.name}</Badge>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <CourseBody course={course} />
        <CourseSidebar course={course} />
      </div>
    </div>
  );
}
