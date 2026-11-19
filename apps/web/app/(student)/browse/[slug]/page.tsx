import { notFound } from 'next/navigation';
import { CourseView, pickSimilar } from '@/components/public/course-view';
import { type PublicCourse, type PublicCourseDetail, publicFetch } from '@/lib/api/public';
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
  const { items } = await publicFetch<{ items: PublicCourse[] }>('/public/courses', { items: [] });
  return (
    <CourseView course={course} similar={pickSimilar(items, course)} basePath="/browse" embedded />
  );
}
