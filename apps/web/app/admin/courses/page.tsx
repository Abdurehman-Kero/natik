import { getTranslations } from 'next-intl/server';
import { CoursesView } from '@/components/admin/courses-view';
import { apiFetch } from '@/lib/api/server';
import type { AdminCourseListItem, Paged } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminCourses');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['ADMIN'], '/admin/courses');
  const params = await searchParams;
  const query = {
    q: one(params.q).slice(0, 100),
    status: ['DRAFT', 'PUBLISHED', 'HIDDEN'].includes(one(params.status)) ? one(params.status) : '',
    page: Math.max(1, Number.parseInt(one(params.page), 10) || 1),
  };
  const search = new URLSearchParams({ page: String(query.page), pageSize: '12' });
  if (query.q) search.set('q', query.q);
  if (query.status) search.set('status', query.status);
  const data = await apiFetch<Paged<AdminCourseListItem>>(`/admin/courses?${search}`);
  return <CoursesView data={data} query={query} />;
}
