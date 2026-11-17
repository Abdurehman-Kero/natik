import { formatDate } from '@natik/shared';
import { Award, Download } from 'lucide-react';
import { CertificateRequestCard } from '@/components/learn/certificate-request-card';
import { getTranslations } from 'next-intl/server';
import { Button, LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import type { MyCertificate, MyCertificateRequest } from '@/lib/api/quiz-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('certs');
  return { title: t('title') };
}

/**
 * The student's certificates, each with a PDF to download (FR-STU-003, FR-CERT-003), and above them the
 * ones on their way: confirm the name to print, then the Natik team approves and sends it.
 */
export default async function CertificatesPage() {
  await requireRole(['STUDENT'], '/certificates');
  const t = await getTranslations('certs');
  const { items, requests } = await apiFetch<{
    items: MyCertificate[];
    requests: MyCertificateRequest[];
  }>('/me/certificates');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {requests.length > 0 ? (
        <section aria-labelledby="on-the-way" className="mb-8 flex flex-col gap-4">
          <h2 id="on-the-way" className="font-sans text-lg font-semibold">
            {t('onTheWay')}
          </h2>
          <ul className="grid gap-4 lg:grid-cols-2">
            {requests.map((r) => (
              <li key={r.id}>
                <CertificateRequestCard request={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {items.length === 0 && requests.length > 0 ? null : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Award}
            title={t('emptyTitle')}
            description={t('emptyText')}
            action={
              <LinkButton href="/courses" size="lg">
                {t('browse')}
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <li key={c.id}>
              <Card className={c.status === 'VALID' ? 'border-accent' : undefined}>
                <CardContent className="flex flex-col gap-3">
                  <span
                    className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong"
                    aria-hidden
                  >
                    <Award className="size-6" />
                  </span>
                  <h2 className="text-lg leading-snug font-semibold">{c.courseTitle}</h2>
                  <p className="font-medium text-ink">{c.nameOnCertificate}</p>
                  <p className="text-sm text-muted">
                    {t('number', { number: c.number })} ·{' '}
                    {t('issued', { date: formatDate(c.issuedAt) })}
                  </p>
                  {c.status === 'CANCELLED' ? (
                    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                      {t('cancelled')}
                    </p>
                  ) : c.pdfUrl ? (
                    <Button asChild variant="accent">
                      {/* A plain link: the PDF comes back as a download, not as a page of the app. */}
                      <a
                        href={c.pdfUrl}
                        download
                        aria-label={t('downloadLabel', { course: c.courseTitle })}
                      >
                        <Download aria-hidden /> {t('download')}
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
