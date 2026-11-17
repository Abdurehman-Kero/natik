import { getTranslations } from 'next-intl/server';
import { EnrolmentsView } from '@/components/admin/enrolments-view';
import type { AdminEnrolment } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import type { Paged } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminEnrolments');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const STATUSES = [
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
];

export default async function AdminEnrolmentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['ADMIN'], '/admin/enrolments');
  const params = await searchParams;
  const filters = {
    courseId: one(params.courseId).slice(0, 60),
    status: STATUSES.includes(one(params.status)) ? one(params.status) : '',
    studentId: one(params.studentId).slice(0, 60),
    studentName: one(params.studentName).slice(0, 100),
  };
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  for (const key of ['courseId', 'status', 'studentId'] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  const [data, courses] = await Promise.all([
    apiFetch<Paged<AdminEnrolment>>(`/admin/enrolments?${query}`),
    apiFetch<{ items: { id: string; title: string }[] }>('/public/courses'),
  ]);
  return (
    <EnrolmentsView
      data={data}
      filters={filters}
      courses={courses.items.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
