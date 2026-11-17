import { getTranslations } from 'next-intl/server';
import { TeacherCourses } from '@/components/teach/teacher-courses';
import { PageHeader } from '@/components/ui/layout';
import { apiFetch } from '@/lib/api/server';
import type { TeacherCourse } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('teachCourses') };
}

export default async function TeacherCoursesPage() {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/courses');
  const t = await getTranslations('pages');
  const { items } = await apiFetch<{ items: TeacherCourse[] }>('/teach/courses');
  return (
    <>
      <PageHeader title={t('teachCourses')} />
      <TeacherCourses courses={items} />
    </>
  );
}
