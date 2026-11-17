import { getTranslations } from 'next-intl/server';
import { CourseEditor } from '@/components/admin/course-editor';
import { apiFetch } from '@/lib/api/server';
import type { LanguageItem, LevelItem } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminCourses');
  return { title: t('newCourse') };
}

export default async function NewCoursePage() {
  await requireRole(['ADMIN'], '/admin/courses/new');
  const [languages, levels] = await Promise.all([
    apiFetch<{ items: LanguageItem[] }>('/admin/languages'),
    apiFetch<{ items: LevelItem[] }>('/admin/levels'),
  ]);
  return (
    <CourseEditor course={null} languages={languages.items} levels={levels.items} teachers={[]} />
  );
}
