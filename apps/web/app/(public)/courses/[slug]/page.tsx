import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CourseView, pickSimilar } from '@/components/public/course-view';
import { type PublicCourse, type PublicCourseDetail, publicFetch } from '@/lib/api/public';

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
  const { items } = await publicFetch<{ items: PublicCourse[] }>('/public/courses', { items: [] });
  return <CourseView course={course} similar={pickSimilar(items, course)} basePath="/courses" />;
}
