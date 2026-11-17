import { getTranslations } from 'next-intl/server';
import { type ReportFilters, ReportsView } from '@/components/admin/reports-view';
import type { ReportData, ReportType } from '@/lib/api/ops-types';
import { apiFetch } from '@/lib/api/server';
import type { AdminCourseListItem, Paged } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/** Today's date in East Africa Time, as year, month and day numbers. */
function eatToday(): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' })
    .format(new Date())
    .split('-')
    .map(Number);
  return { y: y!, m: m!, d: d! };
}
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Turns "This week / This month / Last 30 days" into real dates, counted in East Africa Time. */
function presetRange(preset: string): { from: string; to: string } {
  const { y, m, d } = eatToday();
  const today = new Date(Date.UTC(y, m - 1, d));
  if (preset === 'week') {
    const monday = new Date(today);
    monday.setUTCDate(d - ((today.getUTCDay() + 6) % 7));
    return { from: iso(monday), to: iso(today) };
  }
  if (preset === 'month') return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(today) };
  if (preset === 'last30') {
    const start = new Date(today);
    start.setUTCDate(d - 29);
    return { from: iso(start), to: iso(today) };
  }
  return { from: '', to: '' };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['ADMIN'], '/admin/reports');
  const params = await searchParams;
  const type =
    (['registrations', 'enrolments', 'payments', 'progress'] as const).find(
      (v) => v === one(params.type),
    ) ?? 'registrations';
  const preset =
    (['all', 'week', 'month', 'last30', 'custom'] as const).find((v) => v === one(params.preset)) ??
    'all';
  const range =
    preset === 'custom'
      ? {
          from: DAY.test(one(params.from)) ? one(params.from) : '',
          to: DAY.test(one(params.to)) ? one(params.to) : '',
        }
      : presetRange(preset);
  const filters: ReportFilters = {
    type: type as ReportType,
    preset,
    ...range,
    courseId: type === 'registrations' ? '' : one(params.courseId).slice(0, 60),
  };
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const q = new URLSearchParams({ page: String(page), pageSize: '30' });
  if (filters.from) q.set('from', filters.from);
  if (filters.to) q.set('to', filters.to);
  if (filters.courseId) q.set('courseId', filters.courseId);
  const [data, courses] = await Promise.all([
    apiFetch<ReportData>(`/admin/reports/${type}?${q}`),
    apiFetch<Paged<AdminCourseListItem>>('/admin/courses?pageSize=50'),
  ]);
  return (
    <ReportsView
      data={data}
      filters={filters}
      courses={courses.items.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
