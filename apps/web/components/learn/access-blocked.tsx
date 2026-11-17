'use client';

import { formatDate } from '@natik/shared';
import { CalendarX, Clock, Lock, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EnrolButton, RenewButton } from '@/components/learn/enrol-buttons';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { BlockedInfo } from '@/lib/api/learn-types';

/**
 * Shown instead of a lesson or course the student can't open yet. Always says why and offers the one
 * thing to do next, so nobody is left at a dead end (FR-ENR-006).
 */
export function AccessBlocked({ info }: { info: BlockedInfo }) {
  const t = useTranslations('blocked');

  const view = (() => {
    switch (info.reason) {
      case 'AWAITING_PAYMENT':
        return {
          icon: Wallet,
          title: t('AWAITING_PAYMENT.title'),
          text: t('AWAITING_PAYMENT.text'),
          action: (
            <LinkButton href={`/pay/${info.enrolmentId}`} size="lg">
              {t('AWAITING_PAYMENT.button')}
            </LinkButton>
          ),
        };
      case 'PAYMENT_UNDER_REVIEW':
        return {
          icon: Clock,
          title: t('PAYMENT_UNDER_REVIEW.title'),
          text: t('PAYMENT_UNDER_REVIEW.text'),
          action: (
            <LinkButton href="/dashboard" size="lg">
              {t('PAYMENT_UNDER_REVIEW.button')}
            </LinkButton>
          ),
        };
      case 'EXPIRED':
        return {
          icon: CalendarX,
          title: t('EXPIRED.title'),
          text: info.endAt
            ? t('EXPIRED.text', { date: formatDate(info.endAt) })
            : t('EXPIRED.textNoDate'),
          action: info.enrolmentId ? (
            <RenewButton enrolmentId={info.enrolmentId} slug={info.courseSlug} fullWidth={false} />
          ) : null,
        };
      case 'CANCELLED':
        return {
          icon: Lock,
          title: t('CANCELLED.title'),
          text: t('CANCELLED.text'),
          action: (
            <LinkButton href="/contact" size="lg">
              {t('CANCELLED.button')}
            </LinkButton>
          ),
        };
      default:
        return {
          icon: Lock,
          title: t('NOT_ENROLLED.title'),
          text: t('NOT_ENROLLED.text'),
          action: (
            <EnrolButton
              courseId={info.courseId}
              slug={info.courseSlug}
              isFree={info.isFree}
              fullWidth={false}
            />
          ),
        };
    }
  })();

  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        as="h1"
        icon={view.icon}
        title={view.title}
        description={view.text}
        action={
          <>
            {view.action}
            <LinkButton href={`/courses/${info.courseSlug}`} variant="ghost" size="lg">
              {t('viewCourse')}
            </LinkButton>
          </>
        }
      />
    </Card>
  );
}
