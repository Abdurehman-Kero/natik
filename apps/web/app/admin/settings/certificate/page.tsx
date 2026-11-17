import { getTranslations } from 'next-intl/server';
import { CertificateSettingsForm } from '@/components/admin/certificate-settings';
import { apiFetch } from '@/lib/api/server';
import type { CertificateSettings } from '@/lib/api/quiz-types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('certSettings');
  return { title: t('title') };
}

export default async function CertificateSettingsPage() {
  await requireRole(['ADMIN'], '/admin/settings/certificate');
  const settings = await apiFetch<CertificateSettings>('/admin/settings/certificate');
  return <CertificateSettingsForm initial={settings} />;
}
