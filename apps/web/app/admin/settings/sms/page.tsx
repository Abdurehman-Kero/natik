import { getTranslations } from 'next-intl/server';
import { SmsFailures } from '@/components/admin/sms-failures';
import type { SmsList } from '@/lib/api/ops-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('smsAdmin');
  return { title: t('title') };
}

export default async function SmsSettingsPage() {
  await requireRole(['ADMIN'], '/admin/settings/sms');
  const data = await apiFetch<SmsList>('/admin/sms?status=FAILED');
  return <SmsFailures data={data} />;
}
