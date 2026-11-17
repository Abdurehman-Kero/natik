import { getTranslations } from 'next-intl/server';
import { ActivityView } from '@/components/admin/activity-view';
import type { ActivityList } from '@/lib/api/ops-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('activityLog');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const GROUPS = [
  'SIGN_IN',
  'ACCOUNTS',
  'ENROLMENTS',
  'PAYMENTS',
  'MARKS',
  'CERTIFICATES',
  'COURSES',
  'OTHER',
];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole(['ADMIN'], '/admin/activity');
  const params = await searchParams;
  const filters = {
    group: GROUPS.includes(one(params.group)) ? one(params.group) : '',
    actorId: one(params.actorId).slice(0, 60),
    from: DAY.test(one(params.from)) ? one(params.from) : '',
    to: DAY.test(one(params.to)) ? one(params.to) : '',
  };
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);
  const q = new URLSearchParams({ page: String(page), pageSize: '30' });
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  const data = await apiFetch<ActivityList>(`/admin/activity?${q}`);
  return <ActivityView data={data} filters={filters} />;
}
