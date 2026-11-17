import { Ban, CircleCheck, Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PayForm } from '@/components/learn/pay-form';
import { NoAccess } from '@/components/layout/no-access';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import type { PaymentInfo } from '@/lib/api/learn-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pay');
  return { title: t('title') };
}

/** Today's date in East Africa Time as 2026-11-04, so the date field starts on the right day. */
function todayInEat(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date());
}

/** Where a student pays for a course, or sees that their payment is being checked (FR-PAY). */
export default async function PayPage({ params }: { params: Promise<{ enrolmentId: string }> }) {
  const { enrolmentId } = await params;
  await requireRole(['STUDENT'], `/pay/${enrolmentId}`);
  const t = await getTranslations('pay');
  const tp = await getTranslations('pages');
  const result = await loadOrDenied<PaymentInfo>(
    `/enrolments/${encodeURIComponent(enrolmentId)}/payment`,
  );
  if (!result.ok) return <NoAccess backHref="/dashboard" backLabel={tp('backDashboard')} />;

  const info = result.data;
  const status = info.enrolment.status;
  const courseHref = `/courses/${info.course.slug}`;

  if (status === 'ACTIVE' || status === 'COMPLETED') {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          as="h1"
          icon={CircleCheck}
          title={t('paidTitle')}
          description={t('paidText')}
          action={
            <LinkButton href={`/learn/${info.course.slug}`} size="lg">
              {t('openCourse')}
            </LinkButton>
          }
        />
      </Card>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          as="h1"
          icon={Ban}
          title={t('cancelledTitle')}
          description={t('cancelledText')}
          action={
            <LinkButton href={courseHref} size="lg">
              {t('viewCourse')}
            </LinkButton>
          }
        />
      </Card>
    );
  }
  if (info.underReview) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          as="h1"
          icon={Clock}
          title={t('reviewTitle')}
          description={`${t('reviewText')}${info.underReview.reference ? ` ${t('reviewRef', { ref: info.underReview.reference })}` : ''}`}
          action={
            <LinkButton href="/dashboard" size="lg">
              {t('goDashboard')}
            </LinkButton>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={info.kind === 'RENEWAL' ? t('renewTitle') : t('title')}
        subtitle={info.course.title}
        back={{ href: courseHref, label: info.course.title }}
      />
      <PayForm info={info} today={todayInEat()} />
    </>
  );
}
