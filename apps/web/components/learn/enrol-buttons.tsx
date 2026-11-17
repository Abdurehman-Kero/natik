'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { CourseState, EnrolmentSummary, RenewResult } from '@/lib/api/learn-types';

/** "Enrol free" or "Pay and enrol". Free opens the first lesson at once; paid goes to the payment page. */
export function EnrolButton({
  courseId,
  slug,
  isFree,
  fullWidth = true,
}: {
  courseId: string;
  slug: string;
  isFree: boolean;
  fullWidth?: boolean;
}) {
  const t = useTranslations('courseButton');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enrol() {
    setBusy(true);
    try {
      const enrolment = await api<EnrolmentSummary>(`/courses/${courseId}/enrol`, {
        method: 'POST',
      });
      if (enrolment.status === 'ACTIVE' || enrolment.status === 'COMPLETED') {
        toast.success(t('enrolled'));
        const state = await api<CourseState>(`/me/course-state/${encodeURIComponent(slug)}`);
        const lessonId = state.enrolment?.continueLessonId;
        router.push(lessonId ? `/learn/${slug}/lessons/${lessonId}` : `/learn/${slug}`);
      } else if (enrolment.status === 'AWAITING_PAYMENT' || enrolment.status === 'EXPIRED') {
        router.push(`/pay/${enrolment.id}`);
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Button size="lg" fullWidth={fullWidth} loading={busy} onClick={enrol}>
      {isFree ? t('enrolFree') : t('payAndEnrol')}
    </Button>
  );
}

/** "Renew access". Free courses reopen instantly (Q4); paid ones go to a renewal payment. */
export function RenewButton({
  enrolmentId,
  slug,
  fullWidth = true,
}: {
  enrolmentId: string;
  slug: string;
  fullWidth?: boolean;
}) {
  const t = useTranslations('courseButton');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function renew() {
    setBusy(true);
    try {
      const result = await api<RenewResult>(`/enrolments/${enrolmentId}/renew`, { method: 'POST' });
      if (result.needsPayment) {
        router.push(`/pay/${enrolmentId}`);
      } else {
        toast.success(t('renewed'));
        router.push(`/learn/${slug}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Button size="lg" fullWidth={fullWidth} loading={busy} onClick={renew}>
      {t('renewAccess')}
    </Button>
  );
}
