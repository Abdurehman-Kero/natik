import { getTranslations } from 'next-intl/server';
import { PaymentsQueue } from '@/components/admin/payments-queue';
import type { AdminPayment } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import type { Paged } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminPayments');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['ADMIN'], '/admin/payments');
  const params = await searchParams;
  const status =
    (['SUBMITTED', 'CONFIRMED', 'REJECTED'] as const).find((s) => s === one(params.status)) ??
    'SUBMITTED';
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);
  const data = await apiFetch<Paged<AdminPayment>>(
    `/admin/payments?status=${status}&page=${page}&pageSize=20`,
  );
  return <PaymentsQueue data={data} tab={status} />;
}
