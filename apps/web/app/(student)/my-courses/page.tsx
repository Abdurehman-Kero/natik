import { getTranslations } from 'next-intl/server';
import { MyCoursesView } from '@/components/learn/my-courses-view';
import { PageHeader } from '@/components/ui/layout';
import type { MyCourseItem } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('myCourses');
  return { title: t('title') };
}

export default async function MyCoursesPage() {
  await requireRole(['STUDENT'], '/my-courses');
  const t = await getTranslations('myCourses');
  const { items } = await apiFetch<{ items: MyCourseItem[] }>('/me/courses');
  return (
    <>
      <PageHeader title={t('title')} />
      <MyCoursesView items={items} />
    </>
  );
}
