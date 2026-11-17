'use client';

import { formatDate, formatMoney, MISSING_VALUE } from '@natik/shared';
import { ChartColumn, Download } from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import type { ColumnType, ReportData, ReportType } from '@/lib/api/ops-types';
import { cn } from '@/lib/cn';

const TYPES: ReportType[] = ['registrations', 'enrolments', 'payments', 'progress'];
const PRESETS = ['all', 'week', 'month', 'last30', 'custom'] as const;

export interface ReportFilters {
  type: ReportType;
  preset: (typeof PRESETS)[number];
  from: string;
  to: string;
  courseId: string;
}

function cell(value: string | number | null | undefined, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return MISSING_VALUE;
  if (type === 'date') return formatDate(String(value));
  if (type === 'money') return formatMoney(Number(value));
  if (type === 'percent') return `${value}%`;
  return String(value);
}

/** One of the four reports with its filters, a one-line summary, the table and an Excel-ready CSV (FR-REP-001). */
export function ReportsView({
  data,
  filters,
  courses,
}: {
  data: ReportData;
  filters: ReportFilters;
  courses: { id: string; title: string }[];
}) {
  const t = useTranslations('reports');
  const router = useRouter();
  const pathname = usePathname();
  const [preset, setPreset] = useState(filters.preset);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [courseId, setCourseId] = useState(filters.courseId);

  const query = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ type: filters.type, preset });
    if (preset === 'custom') {
      if (from) p.set('from', from);
      if (to) p.set('to', to);
    }
    if (courseId) p.set('courseId', courseId);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };

  function apply(event: FormEvent) {
    event.preventDefault();
    router.push(`${pathname}?${query()}`);
  }

  // The CSV uses the dates the page is showing (presets were turned into dates on the server).
  const exportQuery = new URLSearchParams();
  if (filters.from) exportQuery.set('from', filters.from);
  if (filters.to) exportQuery.set('to', filters.to);
  if (filters.courseId) exportQuery.set('courseId', filters.courseId);
  const exportHref = `/api/v1/admin/reports/${filters.type}/export?${exportQuery}`;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const showCourse = filters.type !== 'registrations';

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button asChild variant="secondary">
            <a href={exportHref} download>
              <Download aria-hidden /> {t('export')}
            </a>
          </Button>
        }
      />

      <nav
        aria-label={t('title')}
        className="mb-5 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border [&::-webkit-scrollbar]:hidden"
      >
        {TYPES.map((type) => (
          <Link
            key={type}
            href={`${pathname}?type=${type}`}
            aria-current={type === filters.type ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 shrink-0 items-center px-3 font-semibold whitespace-nowrap transition-colors hover:text-primary',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full',
              type === filters.type
                ? 'text-primary after:bg-accent'
                : 'text-muted after:bg-transparent',
            )}
          >
            {t(`tabs.${type}`)}
          </Link>
        ))}
      </nav>

      <form
        onSubmit={apply}
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="sm:w-48">
          <Select
            aria-label={t('date')}
            value={preset}
            onChange={(e) => setPreset(e.target.value as ReportFilters['preset'])}
            options={PRESETS.map((p) => ({ value: p, label: t(`presets.${p}`) }))}
          />
        </div>
        {preset === 'custom' ? (
          <>
            <TextField
              label={t('from')}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              label={t('to')}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        ) : null}
        {showCourse ? (
          <div className="sm:w-64">
            <Select
              aria-label={t('course')}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder={t('allCourses')}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
          </div>
        ) : null}
        <Button type="submit" variant="secondary">
          {t('apply')}
        </Button>
      </form>

      <p className="mb-4 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
        {data.summary.map((s) => (
          <span key={s.label}>
            <span className="font-normal text-muted">{s.label}: </span>
            {cell(s.value, s.type)}
          </span>
        ))}
        <span className="font-normal text-muted">{t('rowsShown', { count: data.total })}</span>
      </p>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState icon={ChartColumn} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            role="region"
            aria-label={t('tableLabel', { name: t(`tabs.${filters.type}`) })}
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-canvas text-muted">
                <tr>
                  {data.columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn(
                        'px-4 py-3 font-semibold whitespace-nowrap',
                        (c.type === 'money' || c.type === 'percent' || c.type === 'number') &&
                          'text-right',
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-3',
                          (c.type === 'money' || c.type === 'percent' || c.type === 'number') &&
                            'text-right tabular-nums',
                          c.key === 'phone' && 'whitespace-nowrap',
                        )}
                      >
                        {cell(row[c.key], c.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination
        className="mt-6"
        page={data.page}
        totalPages={totalPages}
        hrefFor={(page) => `${pathname}?${query({ page: String(page) })}`}
      />
    </>
  );
}
