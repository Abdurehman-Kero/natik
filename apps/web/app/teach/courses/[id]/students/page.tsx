import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { StudentsProgress } from '@/components/teach/students-progress';
import type { ProgressStudent } from '@/lib/api/ops-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('teachStudents');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/** The students of one course with progress and scores, and a way into each one's quiz attempts. */
export default async function CourseStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/courses/${id}/students`);
  const tp = await getTranslations('pages');
  const q = one(sp.q).slice(0, 80);
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: '30' });
  if (q) query.set('q', q);
  const result = await loadOrDenied<{
    items: ProgressStudent[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/teach/courses/${encodeURIComponent(id)}/students?${query}`);
  if (!result.ok) return <NoAccess backHref="/teach/courses" backLabel={tp('teachCourses')} />;
  return (
    <StudentsProgress
      courseId={id}
      items={result.data.items}
      total={result.data.total}
      page={result.data.page}
      pageSize={result.data.pageSize}
      q={q}
    />
  );
}
