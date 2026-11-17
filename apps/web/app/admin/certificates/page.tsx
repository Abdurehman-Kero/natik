import { Settings } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { CertificateRequestsView } from '@/components/admin/certificate-requests-view';
import { type CertificateView, CertificateTabs } from '@/components/admin/certificate-tabs';
import { CertificatesView } from '@/components/admin/certificates-view';
import { LinkButton } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { apiFetch } from '@/lib/api/server';
import type { AdminCertificate, CertificateRequestPage } from '@/lib/api/quiz-types';
import type { Paged } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminCerts');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

const STATUS_FOR = {
  approve: 'AWAITING_APPROVAL',
  waiting: 'AWAITING_NAME',
  returned: 'RETURNED',
} as const;

/**
 * Certificates (FR-CERT). Nothing is sent automatically: first the ones to approve (confirmed by the
 * student), then the ones waiting for a student, the ones sent back, and every certificate issued.
 */
export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['ADMIN'], '/admin/certificates');
  const t = await getTranslations('adminCerts');
  const params = await searchParams;
  const asked = one(params.view);
  const view: CertificateView = (['waiting', 'returned', 'issued'] as const).includes(
    asked as 'waiting',
  )
    ? (asked as CertificateView)
    : 'approve';
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const requestStatus = view === 'issued' ? 'AWAITING_APPROVAL' : STATUS_FOR[view];
  const requests = await apiFetch<CertificateRequestPage>(
    `/admin/certificate-requests?${new URLSearchParams({
      status: requestStatus,
      page: view === 'issued' ? '1' : String(page),
      pageSize: view === 'issued' ? '1' : '20',
    })}`,
  );

  let issued: { data: Paged<AdminCertificate>; query: { q: string; status: string } } | null = null;
  if (view === 'issued') {
    const query = {
      q: one(params.q).slice(0, 80),
      status: ['VALID', 'CANCELLED'].includes(one(params.status)) ? one(params.status) : '',
    };
    const api = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (query.q) api.set('q', query.q);
    if (query.status) api.set('status', query.status);
    issued = { data: await apiFetch<Paged<AdminCertificate>>(`/admin/certificates?${api}`), query };
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <LinkButton href="/admin/settings/certificate" variant="secondary">
            <Settings aria-hidden /> {t('settings')}
          </LinkButton>
        }
      />
      <CertificateTabs view={view} counts={requests.counts} />
      {issued ? (
        <CertificatesView data={issued.data} query={issued.query} />
      ) : (
        <CertificateRequestsView
          data={requests}
          status={STATUS_FOR[view as keyof typeof STATUS_FOR]}
        />
      )}
    </>
  );
}
