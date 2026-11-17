import { getTranslations } from 'next-intl/server';
import { CourseEditor } from '@/components/admin/course-editor';
import { NoAccess } from '@/components/layout/no-access';
import { loadOrDenied } from '@/lib/api/safe';
import { apiFetch } from '@/lib/api/server';
import type { AdminCourseDetail, LanguageItem, LevelItem } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminCourses');
  return { title: t('title') };
}

export default async function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(['ADMIN'], `/admin/courses/${id}`);
  const t = await getTranslations('adminCourses');
  const course = await loadOrDenied<AdminCourseDetail>(`/admin/courses/${encodeURIComponent(id)}`);
  if (!course.ok) return <NoAccess backHref="/admin/courses" backLabel={t('title')} />;

  const [languages, levels, teachers] = await Promise.all([
    apiFetch<{ items: LanguageItem[] }>('/admin/languages'),
    apiFetch<{ items: LevelItem[] }>('/admin/levels'),
    apiFetch<{ items: { id: string; fullName: string }[] }>('/admin/courses/teachers'),
  ]);
  return (
    <CourseEditor
      course={course.data}
      languages={languages.items}
      levels={levels.items}
      teachers={teachers.items}
    />
  );
}
