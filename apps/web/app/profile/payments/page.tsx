import { formatDate, formatMoney } from '@natik/shared';
import { Wallet } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/status-pill';
import type { MyPayment } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('studentPayments');
  return { title: t('title') };
}

/** Every payment the student has sent, and where each stands (FR-PAY-008). */
export default async function PaymentHistoryPage() {
  await requireRole(['STUDENT'], '/profile/payments');
  const t = await getTranslations('studentPayments');
  const tm = await getTranslations('myCourses');
  const { items } = await apiFetch<{ items: MyPayment[] }>('/me/payments');

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/profile', label: t('back') }}
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={t('emptyTitle')}
            description={t('emptyText')}
            action={
              <LinkButton href="/courses" size="lg">
                {tm('browse')}
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/courses/${p.course.slug}`}
                      className="min-w-0 font-semibold hover:underline"
                    >
                      {p.course.title}
                    </Link>
                    <StatusPill status={`payment.${p.status}`} size="sm" />
                  </div>
                  <p className="font-heading text-xl font-bold text-primary">
                    {formatMoney(p.amountSantim)}
                  </p>
                  <p className="text-sm text-muted">
                    {t(`method.${p.method}`)}
                    {p.kind === 'RENEWAL' ? ` · ${t('renewal')}` : ''}
                    {p.reference ? ` · ${t('reference', { ref: p.reference })}` : ''} ·{' '}
                    {t('paidOn', { date: formatDate(p.paidOn) })}
                  </p>
                  {p.status === 'REJECTED' && p.rejectionReason ? (
                    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                      {p.rejectionReason}
                    </p>
                  ) : null}
                  {p.status === 'REJECTED' ? (
                    <LinkButton
                      href={`/pay/${p.enrolmentId}`}
                      variant="secondary"
                      size="sm"
                      className="self-start"
                    >
                      {t('tryAgain')}
                    </LinkButton>
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
